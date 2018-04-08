require('dotenv').config();

const http = require('http');
const express = require('express');
const Twilio = require('twilio');
const client = new Twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const MessagingResponse = Twilio.twiml.MessagingResponse;

const mongoose = require('mongoose');
mongoose.connect(process.env.MONGODB_URI);

const Contact = mongoose.model('Contact', {
  number: String,
  username: {default: 'anon', type: String}
});

var messageSchema = new mongoose.Schema({text: String}, {timestamps: {createdAt: 'created_at'}});
const Message = mongoose.model('Message', messageSchema);

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
  let msg = 'welcome to Boise Noise. sounds of Boise, Udaho. send something and everyone else will get it.';
  let setUsername = 'reply ".setname somename" to set your username. sorry, no pics yet.';

  client.messages
  .create({
    to: from,
    from: process.env.TWILIO_NUMBER,
    body: msg
  })
  .then(message => {
    console.log(message.sid)
  })
  .then(() => {
    return client.messages
    .create({
      to: from,
      from: process.env.TWILIO_NUMBER,
      body: setUsername
    })
  });
}

function configure(number, msg) {
  let [command, arg]= msg.split(" ");
  command = command.toLowerCase();

  console.log('config', command, number);
  if (command.startsWith(".name") || command.startsWith(".setname")) {
    setName(number, arg);
  } else if (command.startsWith(".roll")) {
    roll(number);
  }
}

function roll(number) {
  let roll = Math.floor(Math.random() * 9);
  let result = '' + roll;
  for (let i = 0; i < roll; i++) {
    result += '=';
  }
  result += 'D';
  broadcast(number, result, ".rolls");
}

function setName(number, arg) {
  // set someone's username
  // restrict it to the first 8 char
  let username = arg.substr(0, 8);

  Contact.findOne({number})
  .then(user => {
    user.username = username;
    return user.save();
  })
  .then(user => {
    return client.messages
    .create({
      to: number,
      from: process.env.TWILIO_NUMBER,
      body: `.name now= ${user.username}`
    })
  }); 
}

function broadcast(number, msg, legit) {
  let sender = undefined;

  Contact.findOne({number})
  .then(contact => {
    if (contact === null) {
      help(number);
      let username = 'anon' + ('' + Math.random()).substr(2, 4);
      return Contact.create({number, username});
    }
    return contact;
  })
  .then(contact => {
    sender = contact;
    return Contact.find({});
  })
  .then(contacts => {
    contacts.forEach(contact => {
      // format the message
      let body = `${sender.username}: ${msg}`;
      if (legit) {
        body = `${sender.username} ${legit}: ${msg}`;
      }

      // log everything!
      Message.create({text: body});

      // send it to everyone else, unless result of something legit
      if (legit || contact.number !== number) {
        client.messages
        .create({
          to: contact.number,
          from: process.env.TWILIO_NUMBER,
          body: body,
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
