require('dotenv').config();

const http = require('http');
const express = require('express');
const MessagingResponse = require('twilio').twiml.MessagingResponse;

const app = express();

app.post('/sms', (req, res) => {
  const twiml = new MessagingResponse();

  if (req.body.Body == 'hello') {
    twiml.message('hi!');
  } else if(req.body.Body == 'bye') {
    twiml.message('goodbye');
  } else {
    twiml.message('default response');
  }

  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

app.get('*', (req, res) => {
  res.send('text (206) 900-9011');
});

const PORT = process.env.PORT;
http.createServer(app).listen(PORT, () => {
  console.log('Express server listening on port', PORT);
});
