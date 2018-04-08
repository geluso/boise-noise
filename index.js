require('dotenv').config();

const http = require('http');
const express = require('express');
const Twilio = require('twilio');
const client = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const MessagingResponse = Twilio.twiml.MessagingResponse;

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);

const Contact = mongoose.model('Contact', {number: String});

const app = express();

const bodyParser = require('body-parser');
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post('/sms', (req, res) => {
  let from = req.body.From;
  let msg = req.body.Body;

  if (msg.length < 6 && msg.toLowerCase().startsWith("help")) {
    help(from);
  } else if (msg.startsWith(".")) {
    configure(from, msg);
  } else {
    broadcast(from, msg);
  }

  // send an empty response
  const twiml = new MessagingResponse();
  res.writeHead(200, {'Content-Type': 'text/xml'});
  res.end(twiml.toString());
});

function help(from) {
  let msg = 'Boise Noise. sounds of Boise, Udaho. send something and everyone else will get it.';

  client.messages
  .create({
    to: from,
    from: process.env.TWILIO_NUMBER,
    body: msg
  })
  .then(message => console.log(message.sid));
}

function configure(number, msg) {
  let [command, arg]= msg.split(" ").toLowerCase();
  if (command.startsWith("username")) {
    // set someone's username
    // restrict it to the first 8 char
    let username = arg.substr(0, 8);
    console.log('config', command, username);
  }
}

function broadcast(number, msg) {
  Contact.findOne({number})
  .then(contact => {
    if (contact === null) {
      help(number);
      return Contact.create({number});
    }
    return contact;
  })
  .then(contact => {
    return Contact.find({});
  })
  .then(contacts => {
    contacts.forEach(contact => {
      if (contact.number !== number) {
        client.messages
        .create({
          to: contact.number,
          from: process.env.TWILIO_NUMBER,
          body: msg
        })
        .then(message => console.log(message.sid));
      }
    });
  })
  .catch(err => {
    console.log('error:', err);
    res.status(500).send(err);
    return;
  });
}

app.get('*', (req, res) => {
  res.send('text (206) 900-9011');
});

const PORT = process.env.PORT;
http.createServer(app).listen(PORT, () => {
  console.log('Express server listening on port', PORT);
});
