const gEvent = require('vorpal')();
const {google} = require('googleapis');
const opn = require('opn');
const moment = require('moment');
const chrono = require('chrono-node');

const utils = require('./utils');

const CLIENT_ID = '529444925083-6952tfskogrvl85f2s56dpr2bgqil4op.apps.googleusercontent.com';
const CLIENT_SECRET = '8zAGQ7j7TA6bP807WwJKGmPe';
const REDIRECT_URL = 'urn:ietf:wg:oauth:2.0:oob';

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URL
);

// generate a url that asks permissions for Google Calendar scopes
const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.readonly'
];

let url;

if (utils.checkAuth()) {
  oauth2Client.setCredentials(utils.readConfig());
} else {
  url = oauth2Client.generateAuthUrl({
    // 'online' (default) or 'offline' (gets refresh_token)
    access_type: 'offline',

    // If you only need one scope you can pass it as a string
    scope: scopes
  });
}

gEvent
  .command('connect')
  .description('Connect to your google account')
  .action(function (args, callback) {
    if (utils.checkAuth()) {
      this.log('You are already connected.');
      return callback();
    }
    opn(url);
    callback();
  });

gEvent
  .command('authorize <code>')
  .description('Authorize your account with token')
  .action(async function (args, callback) {
    if (utils.checkAuth()) {
      this.log('You are already connected.');
      return callback();
    }
    const {tokens} = await oauth2Client.getToken(args.code);
    oauth2Client.setCredentials(tokens);

    // Store tokens for next use
    utils.writeConfig(tokens);
    callback();
  });

const Email = gEvent.chalk.black.bgMagenta;
const Summary = gEvent.chalk.bold.red;
const Time = gEvent.chalk.bold.black.bgRed;
const Location = gEvent.chalk.green;

const Yellow = gEvent.chalk.yellow;

gEvent
  .command('list')
  .option('-f, --from [date]', 'Get events from the date[chrono based date parsing]')
  .option('-t, --to [date]', 'Get events until the date[chrono based date parsing]')
  .option('-r, --results <events>', 'Number of events to show')
  .description('List google event')
  .action(async function(args, callback) {
    const calender = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });

    let options = {
      calendarId: 'primary',
      singleEvents: true,
      maxResults: 10
    };

    if(args.options.from) {
      const time = chrono.parseDate(args.options.from);
      if (time) {
        options.timeMin = time.toISOString();
      } else {
        this.log(Yellow('Warning: cannot parse from date'));
      }
    }

    if(args.options.to) {
      const time = chrono.parseDate(args.options.to);
      if (time) {
        options.timeMax = time.toISOString();
      } else {
        this.log(Yellow('Warning: cannot parse to date'));
      }
    }

    if(args.options.results) options.maxResults = args.options.results;

    const res = await calender.events.list(options);
    const data = res.data;

    this.log(Email('Email: '), data.summary);
    this.log();

    data.items.forEach(({ summary, start, end, location, htmlLink }) => {
      this.log(Summary(summary));
      this.log();
      const startTime = moment(start.dateTime).format('MMMM Do YYYY, h:mm:ss a');
      const endTime = moment(end.dateTime).format('MMMM Do YYYY, h:mm:ss a');
      this.log(Time('Start Time: '), startTime, '    ', Time('Start Time: '), endTime);
      this.log(Location(location || 'Location is not available.'));
      this.log(htmlLink);
      this.log();
      this.log();
    });
    callback();
  });

gEvent
  .command('create [summary...]')
  .option('-s, --start [date]', 'Set start date[chrono based date parsing]')
  .option('-e, --end [date]', 'Set end date[chrono based date parsing]')
  .option('-l, --location [eventLocation]', 'Set location of the event')
  .option('--notify', 'Notify me about the event')
  .validate(function (args) {
    if (!args.options.start) {
      return 'start date is missing';
    } else if (!args.options.end) {
      return 'end date is missing';
    } else {
      return true;
    }
  })
  .action(async function (args, callback) {
    const calender = google.calendar({
      version: 'v3',
      auth: oauth2Client
    });

    let event = {
      summary: args.summary.join(' ')
    };

    let time = chrono.parseDate(args.options.start);
    if (time) {
      event.start = { dateTime: time.toISOString() };
    } else {
      this.log(Yellow('Warning: cannot parse \'start\' date'));
      event.start = { dateTime: (new Date()).toISOString() };
    }

    time = chrono.parseDate(args.options.end);
    if (time) {
      event.end = { dateTime: time.toISOString() };
    } else {
      this.log(Yellow('Warning: cannot parse \'end\' date'));
      event.end = { dateTime: (new Date()).toISOString() };
    }

    if(args.options.notify) {
      event.sendNotifications = true;
    }

    if(args.options.location) {
      event.location = args.options.location;
    }

    const options = {
      calendarId: 'primary',
      resource: event
    };

    const res = await calender.events.insert(options);
    const { summary, start, end, location, htmlLink } = res.data;

    this.log(Summary(summary));
    this.log();
    const startTime = moment(start.dateTime).format('MMMM Do YYYY, h:mm:ss a');
    const endTime = moment(end.dateTime).format('MMMM Do YYYY, h:mm:ss a');
    this.log(Time('Start Time: '), startTime, '    ', Time('Start Time: '), endTime);
    this.log(Location(location || 'Location is not available.'));
    this.log(htmlLink);
    this.log();
    this.log();
    callback();
  });

gEvent
  .command('disconnect')
  .description('Disconnect the current google account')
  .action(async function (args, callback) {
    // Simply erase the access_token and refresh_token
    utils.writeConfig({});
    callback();
  });

gEvent
  .delimiter('gevent $')
  .show();