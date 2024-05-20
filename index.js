const http = require("http");
const axios = require("axios");
const fs = require("fs");
const minimist = require("minimist");
const isEqual = require("lodash/isEqual");

function flattenAndSortObject(obj) {
    function sortArray(array) {
        return array.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
    }

    function flattenObject(obj, parentKey = '', result = {}) {
        for (let key in obj) {
            if (!obj.hasOwnProperty(key)) continue;

            let newKey = parentKey ? `${parentKey}.${key}` : key;

            if (Array.isArray(obj[key])) {
                // Sort the array to ensure consistent order
                let sortedArray = sortArray(obj[key]);
                sortedArray.forEach((item, index) => {
                    flattenObject(item, `${newKey}[${index}]`, result);
                });
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                flattenObject(obj[key], newKey, result);
            } else {
                result[newKey] = obj[key];
            }
        }

        return result;
    }

    let flattened = flattenObject(obj);
    let sortedKeys = Object.keys(flattened).sort();
    let sortedResult = {};

    sortedKeys.forEach(key => {
        sortedResult[key] = flattened[key];
    });

    return sortedResult;
}


// Parse command-line arguments
const args = minimist(process.argv.slice(2), {
  alias: {
    h: "host",
    p: "port",
    m: "mode",
    d: "directory",
  },
  default: {
    host: "localhost:3000",
    port: 8888,
    mode: "record",
    directory: "records",
  },
});

function appendRequestResponse(clientReq, body, response) {
  //   console.log("\x1b[33m", JSON.parse(body), "\x1b[0m");
  //   console.log("\x1b[32m", flatten(JSON.parse(body)), "\x1b[0m");

  const fileName = `${args.directory}/${
    clientReq.method
  }_${clientReq.url.replace(/\//g, "_")}.record.json`;

  // Read existing data from file or create an empty array
  let data = [];
  try {
    const existingData = fs.readFileSync(fileName, "utf8");
    data = JSON.parse(existingData);
  } catch (error) {
    // File does not exist or is empty, no need to handle this error
  } finally {
    console.log(
      "\x1b[32m",
      "Request recorded -- ",
      new Date().toISOString(),
      "\x1b[0m"
    );

    data.push({ request: flattenAndSortObject(JSON.parse(body)), response: response.data });
    // Save updated data to file
    fs.writeFileSync(fileName, JSON.stringify(data));
  }
}

// Function to replay saved response
function replayResponse(clientReq, body, response) {
  const fileName = `${args.directory}/${
    clientReq.method
  }_${clientReq.url.replace(/\//g, "_")}.record.json`;

  try {
    // Attempt to read the saved response file
    const data = fs.readFileSync(fileName, "utf8");
    const responseData = JSON.parse(data);

    for (let index = 0; index < responseData.length; index++) {
      const record = responseData[index];

      if (isEqual(record.request, flattenAndSortObject(JSON.parse(body)))) {
        console.log("Replayed -- ", new Date().toISOString());
        response.writeHead(200, { "Content-Type": "application/json" });
        response.end(JSON.stringify(record.response));
        return;
      }
    }
    console.log("404 : No record found -- ", new Date().toISOString());
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({ error: "No record found for this request." })
    );
  } catch (error) {
    console.error("\x1b[31m", error, "\x1b[0m");

    response.writeHead(404, { "Content-Type": "text/plain" });
    response.end("Response not found");
  }
}

// Create a simple HTTP server
const server = http.createServer((clientReq, clientRes) => {
  let body = "";
  clientReq
    .on("data", (chunk) => {
      body += chunk;
    })
    .on("end", () => {
      // Determine mode based on command line argument
      const mode = args.mode;

      if (mode === "record") {
        // Forward request to host

        try {
          fetcher(clientReq, body).then((response) => {
            appendRequestResponse(clientReq, body, response);
            clientRes.writeHead(200, { "Content-Type": "application/json" });
            clientRes.end(JSON.stringify(response.data));
          });
        } catch (error) {
          console.error(error);
        }
      } else if (mode === "replay") {
        // Replay saved response
        replayResponse(clientReq, body, clientRes);
      } else {
        clientRes.writeHead(400, { "Content-Type": "text/plain" });
        clientRes.end("Invalid mode");
      }
    });
});

// Get host and port from command line arguments
const host = "localhost";
const port = args.port;

// create recording folder
const createDirIfNotExists = (dir) =>
  !fs.existsSync(dir) ? fs.mkdirSync(dir) : undefined;

console.log("Directory : ", args.directory);
createDirIfNotExists(args.directory);

// Start the server
server.listen(port, host, () => {
  console.log(`Server running at http://${host}:${port}/, mode: ${args.mode}`);
});

const fetcher = async (clientReq, data) => {
  let config = {
    method: clientReq.method,
    maxBodyLength: Infinity,
    baseURL: args.host,
    url: clientReq.url,
    headers: {
      "Content-Type": "application/json",
    },
    data: data,
  };

  const response = await axios.request(config);

  return response;
};
