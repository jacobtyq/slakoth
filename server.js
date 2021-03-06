require('dotenv').config();
const got = require('got');
const spacetime = require('spacetime')
const { WebClient } = require('@slack/client');
const web = new WebClient(process.env.SLACK_TOKEN);

const TIMEZONE = 'Asia/Singapore';

var cycleIndex = 0;
var cycle = function(list){
  if (cycleIndex < list.length) cycleIndex++;
  else cycleIndex = 1
  return list[cycleIndex -1];
};
var webuildColors = ['#c11a18', '#e06149', '#228dB7', '#f1e9b4'];

const generateMessage = async () => {
  const nowDate = spacetime.now(TIMEZONE);
  const newEventsResponse = await got('https://engineers.sg/api/events', {
    json: true,
  });
  // const oldEventsResponse = await got('https://webuild.sg/api/v1/events', {
  //   json: true,
  // });
  const events = [
    ...newEventsResponse.body.events,
    // ...oldEventsResponse.body.events
  ].sort((a, b) => new Date(a.start_time) - new Date(b.start_time))
    .filter((ev, i) => {
      const eventDate = spacetime(ev.start_time);
      eventDate.goto(TIMEZONE);
      if (i == 0) console.log(nowDate.format('iso-short'), '↔️ ', eventDate.format('iso-short'));
      return nowDate.format('iso-short') == eventDate.format('iso-short');
    })
    .slice(0, 15);

  const attachments = events.map((event) => {
    const dt = spacetime(event.start_time);
    dt.goto(TIMEZONE);
    const time = dt.format('time');
    const groupName = event.group_name.trim().replace(/\*/g, '٭­');
    const location = event.location.trim().replace(/\*/g, '٭');
    return {
      title: event.name,
      title_link: event.url,
      color: cycle(webuildColors),
      text: `at *${time}* by ${groupName}\n${location}`
    };
  });

  const msg = events.length ? {
    text: `📢 *${events.length}* tech event${events.length == 1 ? '' : 's'} today!`,
    attachments,
  } : {
    text: '😭 No tech events today',
  };

  return msg;
}

const postEvents = async () => {
  const msg = await generateMessage();
  web.chat.postMessage({
    channel: process.env.SLACK_CHANNEL,
    ...msg,
  })
    .then((res) => {
      console.log('Message sent: ', res.ok, res.ts);
    })
    .catch(console.error);
};

const schedulePost = () => {
  const now = spacetime.now(TIMEZONE);
  const scheduledToday = spacetime.now(TIMEZONE).hour(10).nearest('hour'); // 10 AM today
  if (now.isBefore(scheduledToday)){
    const diff = now.diff(scheduledToday);
    setTimeout(() => {
      postEvents();
      setTimeout(schedulePost, 5000);
    }, Math.abs(diff.milliseconds));
    console.log(`${now.format('nice')} - Posting in next ${diff.minutes} minutes(s).`);
  } else if (now.isAfter(scheduledToday)) {
    const scheduledTomorrow = spacetime.tomorrow(TIMEZONE).hour(10).nearest('hour'); // 10 AM tomorrow
    const diff = now.diff(scheduledTomorrow);
    setTimeout(() => {
      postEvents();
      setTimeout(schedulePost, 5000);
    }, Math.abs(diff.milliseconds));
    console.log(`${now.format('nice')} - Posting in next ${diff.hours} hour(s).`);
  } else { // Exactly on time!
    postEvents();
    setTimeout(schedulePost, 5000);
    console.log(`${now.format('nice')} - Posting NOW!`);
  }
};
schedulePost();

const http = require('http');
http.createServer(async (req, res) => {
  if (req.url == '/'){
    const msg = await generateMessage();
    res.setHeader('content-type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify(msg, null, '\t'));
  } else if (req.url == '/post'){
    await postEvents();
    res.setHeader('content-type', 'text/plain');
    res.statusCode = 200;
    res.end('Posted message to channel');
  } else {
    res.setHeader('content-type', 'text/plain');
    res.statusCode = 404;
    res.end('404');
  }
}).listen(process.env.PORT || 1337);