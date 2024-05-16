const http = require('http');
const axios = require('axios');
const fs = require('fs');
const minimist = require('minimist');
const isEqual = require('lodash/isEqual')
const { parse } = require('querystring');

// Parse command-line arguments
const args = minimist(process.argv.slice(2), {
    alias: {
        h: 'host',
        p: 'port',
        m: 'mode'
    },
    default: {
        host: '192.168.30.10:8014',
        port: 8888,
        mode: 'record'
    }
});

// Function to append request and response
function appendRequestResponse(clientReq, body, response) {
    // Generate a unique filename based on request path and method
    const fileName = `records/${clientReq.method}_${clientReq.url.replace(/\//g, '_')}.json`;
    
    // Read existing data from file or create an empty array
    let data = [];
    try {
        const existingData = fs.readFileSync(fileName, 'utf8');
        data = JSON.parse(existingData);
    } catch (error) {
        // File does not exist or is empty, no need to handle this error
    } finally{
        console.log("\x1b[32m", "Request recorded -- ", new Date().toISOString(), "\x1b[0m");
        data.push({ request: JSON.parse(body), response: response.data });
        // Save updated data to file
        fs.writeFileSync(fileName, JSON.stringify(data));
    }
}

// Function to replay saved response
function replayResponse(clientReq, body, response) {
    
    // Generate the filename to search for saved response
    const fileName = `records/${clientReq.method}_${clientReq.url.replace(/\//g, '_')}.json`;

    try {
        // Attempt to read the saved response file
        const data = fs.readFileSync(fileName, 'utf8');
        const responseData = JSON.parse(data);

        for (let index = 0; index < responseData.length; index++) {
            const record = responseData[index];
            if (isEqual(record.request, JSON.parse(body) )) {
                console.log("Replayed -- ", new Date().toISOString());
                response.writeHead(200, { 'Content-Type': 'application/json' });
                response.end(JSON.stringify(record.response));
                return;
            }
        }
        console.log("404 : No record found -- ", new Date().toISOString());
        response.writeHead(200, { 'Content-Type': 'application/json' });
        response.end(JSON.stringify({error: "No record found for this request." }));

        
    } catch (error) {
        console.error("\x1b[31m", error, "\x1b[0m");

        response.writeHead(404, { 'Content-Type': 'text/plain' });
        response.end('Response not found');
    }
}

// Create a simple HTTP server
const server = http.createServer((clientReq, clientRes) => {
    let body = '';
    clientReq.on('data', (chunk) => {
        body += chunk;
    }).on('end', () => {
        // Determine mode based on command line argument
        const mode = args.mode;
        
        if (mode === 'record') {
            // Forward request to host

            try {
                fetcher(body).then((response)=>{
                    appendRequestResponse(clientReq, body, response);
                    clientRes.writeHead(200, { 'Content-Type': 'application/json' });
                    clientRes.end(JSON.stringify(response.data));
                })
            } catch (error) {
                console.error(error)
            }

        } else if (mode === 'replay') {
            // Replay saved response
            replayResponse(clientReq, body, clientRes);
        } else {
            clientRes.writeHead(400, { 'Content-Type': 'text/plain' });
            clientRes.end('Invalid mode');
        }
    });
});

// Get host and port from command line arguments
const host = 'localhost';
const port = args.port;

// Start the server
server.listen(port, host, () => {
    console.log(`Server running at http://${host}:${port}/, mode: ${args.mode}`);
});


const fetcher = async (data)=> {
    let config = {
        method: 'post',
        maxBodyLength: Infinity,
        url: 'http://192.168.30.10:8018/JNNJ',
        headers: { 
            'Content-Type': 'application/json'
        },
        data : data,
    };

    const response = await axios.request(config)

    return response;

}