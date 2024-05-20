# Vroxy
wip api recorder/replayer for dev and tests

# Usage

install deps
```shell
npm i
```
options :
```shell
  -h (--host) : host to record   , [default = localhost:3000]
  -m (--mode) : record | replay  , [default = record]
  -p (--port) : port for vroxy   , [default = 8888]
```

launch in record mode :
```shell
node index.js -h http://192.168.30.10:8018/JNNJ -p 3003
```

launch in replay mode :
```shell
node index.js -m replay
```
