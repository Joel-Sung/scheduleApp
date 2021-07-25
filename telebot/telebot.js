var { Telegraf, Scenes, session,  Markup, Composer } = require('telegraf');
var bot = new Telegraf(/* insert telegram bot token here */);

bot.command('quickbill', (ctx) => { 
	const text = "<a href='https://joelsung.com/21098/teleBill/#/" + ctx.message.chat.id + "/'>Create a bill here</a>";
	ctx.telegram.sendMessage(ctx.message.chat.id, text, { parse_mode: 'HTML' });
});

bot.command('mahjong', (ctx) => { 
	const text = "<a href='https://joelsung.com/21098/mahjong/#/initialize/'>Mahjong chips tracker</a>";
	ctx.telegram.sendMessage(ctx.message.chat.id, text, { parse_mode: 'HTML' });
});

const admin = require('firebase-admin');
var serviceAccount = require(/* path to service-account-file */);
const config = {
    credential: admin.credential.cert(serviceAccount),
};
admin.initializeApp(config);
const db = admin.firestore();

const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
/* ---------- Day Handler ---------- */
const dayHandler = new Composer();
dayHandler.on('callback_query', (ctx) => {
    if (ctx.callbackQuery.data == undefined) {
        return ctx.scene.leave();
    } else {
        ctx.wizard.state.day = ctx.callbackQuery.data;
        ctx.answerCbQuery();
        ctx.wizard.next();
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    }
});
/* ---------- Add Event scenes ---------- */
const addEvent = new Scenes.WizardScene(
    'addEvent',
    (ctx) => {
        ctx.wizard.state.userId = ctx.from.id;
        ctx.wizard.state.chatId = ctx.update.callback_query.message.chat.id;
        async function getDay() {
            const sent = await ctx.reply('Which day do you want to add an event to?', Markup.inlineKeyboard(
                days.map((day) => {
                    return {text: day.substr(0,3), callback_data: day};
                })
            ));
            ctx.wizard.state.prevMessageId = sent.message_id;
            return ctx.wizard.next();
        }
        getDay();
    },
    dayHandler,
    (ctx) => {
        bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
        async function getTime() {
            const sent = await ctx.reply('What time does the event start? Enter in hh:mm (am/pm) or 24hr clock format. \n' +
                                        '(E.g. 9:30 am or 0930)');
            ctx.wizard.state.prevMessageId = sent.message_id;
            return ctx.wizard.next();
        }
        getTime();
    },
    (ctx) => {
        const timeStr = ctx.message.text;
        let time = 0;
        try {
            time = parseTime(timeStr);
        } catch(err) {
            ctx.reply(err.message);
            return ctx.wizard.selectStep(3);
        }
        ctx.wizard.state.startTime = time;
        async function checkTime() {
            ctx.wizard.state.prevEvent = await getPrevEvent(ctx.wizard.state.userId, ctx.wizard.state.day, time);
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        }
        checkTime();
    },
    (ctx) => {
        bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
        async function getTime() {
            const sent = await ctx.reply('What time does the event end? Enter in hh:mm (am/pm) or 24hr clock format. \n' +
                                        '(E.g. 9:30 pm or 2130)');
            ctx.wizard.state.prevMessageId = sent.message_id;
            return ctx.wizard.next();
        }
        getTime();
    },
    (ctx) => {
        const timeStr = ctx.message.text;
        let time = 0;
        try {
            time = parseTime(timeStr);
        } catch(err) {
            ctx.reply(err.message);
            return ctx.wizard.selectStep(5);
        }
        ctx.wizard.state.endTime = time;
        ctx.wizard.next();
        return ctx.wizard.steps[ctx.wizard.cursor](ctx);
    },
    (ctx) => {
        bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
        if (ctx.wizard.state.prevEvent == undefined) {
            ctx.reply('Enter Event details for ' + ctx.wizard.state.day + ' ' + 
                    displayTime(ctx.wizard.state.startTime) + ' to ' + displayTime(ctx.wizard.state.endTime) + '.');
        } else {
            async function reply() {
                await ctx.reply('Event details previously entered for ' + ctx.wizard.state.day + ' ' + 
                        displayTime(ctx.wizard.state.prevEvent.startTime) + ' to ' + displayTime(ctx.wizard.state.prevEvent.endTime) + ':'
                );
                await ctx.reply(ctx.wizard.state.prevEvent.details);
                await ctx.reply('Enter new Event details. Note: Entire event will be overwritten including start and end timings.');
            }
            reply();
        }
        return ctx.wizard.next();
    },
    (ctx) => {
        const details = ctx.message.text;
        updateUser(ctx.wizard.state.userId, ctx.wizard.state.day, ctx.wizard.state.startTime, ctx.wizard.state.endTime, details);
        ctx.reply('Event added. Call /schedule to perform another action.');
        return ctx.scene.leave();
    }
);
/* ---------- Time Handler ---------- */
const timeHandler = new Composer();
timeHandler.on('callback_query', (ctx) => {
    ctx.wizard.state.startTime = ctx.callbackQuery.data;
    ctx.answerCbQuery();
    ctx.wizard.next();
    return ctx.wizard.steps[ctx.wizard.cursor](ctx);
});
/* ---------- Time Handler ---------- */
const editHandler = new Composer();
editHandler.on('callback_query', (ctx) => {
    ctx.wizard.state.edit = ctx.callbackQuery.data;
    ctx.answerCbQuery();
    ctx.wizard.next();
    return ctx.wizard.steps[ctx.wizard.cursor](ctx);
});
/* ---------- Edit Event scenes ---------- */
const editEvent = new Scenes.WizardScene(
    'editEvent',
    (ctx) => {
        ctx.wizard.state.userId = ctx.from.id;
        ctx.wizard.state.chatId = ctx.update.callback_query.message.chat.id;
        async function dayOptions() {
            const document = await db.collection("users").doc(ctx.wizard.state.userId.toString()).get();
            const schedule = await document.data().schedule;
            ctx.wizard.state.schedule = schedule;
            const buttons = schedule.map((dayEvents, index) => {
                                        return {events: dayEvents.events, day: days[index]};
                                    }).filter((dayEvents) => {
                                        return dayEvents.events.length > 0;
                                    });
            if (buttons.length == 0) {
                ctx.reply('There are no events to edit. Go to Edit Schedule -> Add Event to add an event.\n\nCall /schedule to perform another action.');
            } else {
                const sent = await ctx.reply('Which day\'s events do you want to edit?', Markup.inlineKeyboard(
                    buttons.map((dayEvents) => {
                        return {text: dayEvents.day.substr(0, 3), callback_data: dayEvents.day};
                    })
                ));
                ctx.wizard.state.prevMessageId = sent.message_id;
            }
            return ctx.wizard.next();
        }
        dayOptions();
    },
    dayHandler,
    (ctx) => {
        bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
        async function timeOptions() {
            const dayIndex = days.indexOf(ctx.wizard.state.day);
            const events = ctx.wizard.state.schedule[dayIndex].events;
            const sent = await ctx.reply('Which time?', Markup.inlineKeyboard(
                events.map((event) => {
                    return {text: displayTime(event.startTime), callback_data: event.startTime};
                })
            ));
            ctx.wizard.state.prevMessageId = sent.message_id;
            return ctx.wizard.next();
        }
        timeOptions();
    },
    timeHandler,
    (ctx) => {
        bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
        const dayIndex = days.indexOf(ctx.wizard.state.day);
        const prevEvent = ctx.wizard.state.schedule[dayIndex].events.find((event) => event.startTime == ctx.wizard.state.startTime);
        ctx.wizard.state.prevDetails = prevEvent.details;
        async function reply() {
            await ctx.reply('Previously entered event details for ' + ctx.wizard.state.day + ' ' + 
                    displayTime(prevEvent.startTime) + ' to ' + displayTime(prevEvent.endTime) + ':'
            );
            await ctx.reply(prevEvent.details);
            const sent = await ctx.reply('What do you want to edit?', Markup.inlineKeyboard([
                [{text: 'Change details', callback_data: 'details'}, {text: 'Change timing', callback_data: 'timing'}],
                [{text: 'Change everything', callback_data: 'everything'}],
                [{text: 'Delete event', callback_data: 'delete'}]
            ]));
            ctx.wizard.state.prevMessageId = sent.message_id;
        }
        reply();
        return ctx.wizard.next();
    },
    editHandler,
    (ctx) => {
        bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
        if (ctx.wizard.state.edit == 'delete') {
            deleteEvent(ctx.wizard.state.userId, ctx.wizard.state.day, ctx.wizard.state.startTime);
            ctx.reply('Event deleted. Call /schedule to perform another action.');
            return ctx.scene.leave();
        } else {
            async function getEdit() {
                let sent = '';
                if (ctx.wizard.state.edit == 'details') {
                    sent = await ctx.reply('Enter new details.');
                } else if (ctx.wizard.state.edit == 'timing' || ctx.wizard.state.edit == 'everything') {
                    sent = await ctx.reply('Enter new start time. Enter in hh:mm (am/pm) or 24hr clock format. \n' +
                        '(E.g. 9:30 am or 0930)');
                }
                ctx.wizard.state.prevMessageId = sent.message_id;
                return ctx.wizard.next();
            }
            getEdit();
        }
    },
    (ctx) => {
        bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
        async function getEdit() {
            if (ctx.wizard.state.edit == 'details') {
                const newDetails = ctx.message.text;
                updateUserDetails(ctx.wizard.state.userId, ctx.wizard.state.day, ctx.wizard.state.startTime, newDetails);
                ctx.reply('Event details edited. Call /schedule to perform another action.');
                return ctx.scene.leave();
            } else if (ctx.wizard.state.edit == 'timing' || ctx.wizard.state.edit == 'everything') {
                const timeStr = ctx.message.text;
                let startTime = 0;
                try {
                    startTime = parseTime(timeStr);
                } catch(err) {
                    ctx.reply(err.message);
                    return;
                }
                ctx.wizard.state.newStartTime = startTime;
            }
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        }
        getEdit();
    },
    (ctx) => {
        async function getTime() {
            const sent = await ctx.reply('Enter new end time. Enter in hh:mm (am/pm) or 24hr clock format. \n' +
                                        '(E.g. 9:30 pm or 2130)');
            ctx.wizard.state.prevMessageId = sent.message_id;
            return ctx.wizard.next();
        }
        getTime();
    },
    (ctx) => {
        bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
        const timeStr = ctx.message.text;
        let endTime = 0;
        try {
            endTime = parseTime(timeStr);
        } catch(err) {
            ctx.reply(err.message);
            return;
        }
        ctx.wizard.state.newEndTime = endTime;
        if (ctx.wizard.state.edit == 'timing') {
            relocateEvent(ctx.wizard.state.userId, ctx.wizard.state.day, ctx.wizard.state.startTime, 
                ctx.wizard.state.newStartTime, endTime, ctx.wizard.state.prevDetails);
            ctx.reply('Event timings edited. Call /schedule to perform another action.');
            return ctx.scene.leave();
        } else if (ctx.wizard.state.edit == 'everything') {
            async function getEdit() {
                const sent = await ctx.reply('Enter new details.');
                ctx.wizard.state.prevMessageId = sent.message_id;
                return ctx.wizard.next();
            }
            getEdit();
        } 
    },
    (ctx) => {
        bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
        const newDetails = ctx.message.text;
        relocateEvent(ctx.wizard.state.userId, ctx.wizard.state.day, ctx.wizard.state.startTime, 
            ctx.wizard.state.newStartTime, ctx.wizard.state.newEndTime, newDetails);
        ctx.reply('Event details edited. Call /schedule to perform another action.');
        return ctx.scene.leave();
    }
);
/* ---------- Get Schedule scenes ---------- */
const getSchedule = new Scenes.WizardScene(
    'getSchedule',
    (ctx) => {
        ctx.wizard.state.userId = ctx.from.id;
        ctx.wizard.state.username = ctx.from.username;
        ctx.wizard.state.chatId = ctx.update.callback_query.message.chat.id;
        async function getDay() {
            const sent = await ctx.reply('Which day\'s schedule do you want?', Markup.inlineKeyboard([
                days.map((day) => {
                    return {text: day.substr(0,3), callback_data: day};
                }),
                [{text: 'All', callback_data: 'All'}]
            ]));
            ctx.wizard.state.prevMessageId = sent.message_id;
            return ctx.wizard.next();
        }
        getDay();
    },
    dayHandler,
    (ctx) => {
        bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
        async function getSchedule() {
            const document = await db.collection('users').doc(ctx.wizard.state.userId.toString()).get();
            if (!document.exists) {
                await initializeUser(ctx.wizard.state.userId);
                document = await db.collection('users').doc(ctx.from.id.toString()).get();
            }
            const schedule = await document.data().schedule;
            if (ctx.wizard.state.day != 'All') {
                ctx.reply(printSchedule(schedule, ctx.wizard.state.username, ctx.wizard.state.day), {parse_mode: 'Markdown'});
            } else {
                ctx.reply(printFullSchedule(schedule, ctx.wizard.state.username), {parse_mode: 'Markdown'});
            }
            return ctx.scene.leave();
        }
        getSchedule();
    },
);
/* ---------- Action Handler ---------- */
const ActionHandler = new Composer();
ActionHandler.on('callback_query', (ctx) => {
    bot.telegram.deleteMessage(ctx.wizard.state.chatId, ctx.wizard.state.prevMessageId);
    async function moveOn() {
        if (ctx.callbackQuery.data == 'getSchedule') {
            await checkInitialized(ctx.wizard.state.userId);
            return ctx.scene.enter('getSchedule');
        } else if (ctx.callbackQuery.data == 'editSchedule') {
            ctx.wizard.next();
            return ctx.wizard.steps[ctx.wizard.cursor](ctx);
        } else if (ctx.callbackQuery.data == 'addEvent') {
            await checkInitialized(ctx.wizard.state.userId);
            return ctx.scene.enter('addEvent');
        } else if (ctx.callbackQuery.data == 'editEvent') {
            await checkInitialized(ctx.wizard.state.userId);
            return ctx.scene.enter('editEvent');
        }
    }
    moveOn();
});
/* ---------- Get Action scenes ---------- */
const getAction = new Scenes.WizardScene(
    'getAction',
    (ctx) => {
        ctx.wizard.state.userId = ctx.from.id;
        ctx.wizard.state.chatId = ctx.message.chat.id;
        async function getAction() {
            const sent = await ctx.reply('Hi @' + ctx.message.from.username + '!', Markup.inlineKeyboard([
                [{text: 'Get Schedule', callback_data: 'getSchedule'}],
                [{text: 'Edit Schedule', callback_data: 'editSchedule'}]
            ]));
            ctx.wizard.state.prevMessageId = sent.message_id;
            return ctx.wizard.next();
        }
        getAction();
    },
    ActionHandler,
    (ctx) => {
        async function getAction() {
            const sent = await ctx.reply('What do you want to do?', Markup.inlineKeyboard([
                [{text: 'Add event', callback_data: 'addEvent'}],
                [{text: 'Edit event', callback_data: 'editEvent'}]
            ]));
            ctx.wizard.state.prevMessageId = sent.message_id;
            return ctx.wizard.next();
        }
        getAction();
    },
    ActionHandler,
);
const stage = new Scenes.Stage([addEvent, editEvent, getSchedule, getAction]);
/* ---------- Exit Scene ---------- */
stage.command('exit', (ctx) => {
    ctx.scene.leave();
    ctx.telegram.sendMessage(ctx.message.chat.id, 'Process cancelled. Call /schedule to restart.');
});
bot.use(session());
bot.use(stage.middleware());
bot.command('schedule', (ctx) => {
    ctx.scene.enter('getAction');
});
/* ---------- Common functions ---------- */
// Return the schedule for the day as a String.
function printSchedule(fullSchedule, username, day) {
    const dayIndex = days.indexOf(day);
    const events = fullSchedule[dayIndex].events;
    let schedule = '*' + username + '\'s schedule for ' + day + ': \n\n' + '*';
    if (events.length == 0) {
        schedule = 'There are no events scheduled.\n\n';
    } else {
        for (i = 0; i < events.length; i++) {
            schedule += '_' + displayTime(events[i].startTime) + '_' + ' to ' + '_' + displayTime(events[i].endTime) + '_' +'\n' + 
                        events[i].details + '\n\n';
        }
    }
    schedule += 'Call /schedule to perform another action.';
    return schedule;
}
// Return the full schedule for the week as a String.
function printFullSchedule(fullSchedule, username) {
    let schedule = username + '\'s schedule for the week:\n\n';
    for (j = 0; j < fullSchedule.length; j++) {
        schedule += '*' + days[j] + ': ' + '*' + '\n\n';
        if (fullSchedule[j].events.length == 0) {
            schedule += 'There are no events scheduled.\n\n';
        } else {
            for (i = 0; i < fullSchedule[j].events.length; i++) {
                schedule += '_' + displayTime(fullSchedule[j].events[i].startTime) + '_' + ' to ' + '_' + displayTime(fullSchedule[j].events[i].endTime) + '_' + '\n' + 
                            fullSchedule[j].events[i].details + '\n\n';
            }
        }
    }
    schedule += 'Call /schedule to perform another action.';
    return schedule;
}
// Check if user is in database, if not then initialize user.
async function checkInitialized(userId) {
    const document = await db.collection('users').doc(userId.toString()).get();
    if (!document.exists) {
        await initializeUser(userId);
    }
}
// Initialize the user in database.
async function initializeUser(userId) {
    await db.collection('users').doc(userId.toString()).set({
        schedule: [
            {events: []},{events: []},{events: []},{events: []},{events: []},{events: []},{events: []},
        ]
    });
}
// Insert a new event for the user.
async function updateUser(userId, day, startTime, endTime, details) {
    const event = {
        startTime: startTime,
        endTime: endTime,
        details: details
    }
    const document = await db.collection("users").doc(userId.toString()).get();
    const schedule = await document.data().schedule;
    const dayIndex = days.indexOf(day);
    const prevEvent = schedule[dayIndex].events.find((event) => event.startTime == startTime);
    if (prevEvent != undefined) {
        eventIndex = schedule[dayIndex].events.indexOf(prevEvent);
        schedule[dayIndex].events.splice(eventIndex, 1, event);
    } else {
        eventIndex = sortedIndex(schedule[dayIndex].events, startTime);
        schedule[dayIndex].events.splice(eventIndex, 0, event);
    }
    await db.collection("users").doc(userId.toString()).update({schedule: schedule});
}
// Update the details of an existing event for the user.
async function updateUserDetails(userId, day, startTime, newDetails) {
    const document = await db.collection("users").doc(userId.toString()).get();
    const schedule = await document.data().schedule;
    const dayIndex = days.indexOf(day);
    const prevEvent = schedule[dayIndex].events.find((event) => event.startTime == startTime);
    if (prevEvent != undefined) {
        eventIndex = schedule[dayIndex].events.indexOf(prevEvent);
        schedule[dayIndex].events[eventIndex].details = newDetails;
    }
    await db.collection("users").doc(userId.toString()).update({schedule: schedule});
}
// Update the timing (& details) of an existing event for the user.
async function relocateEvent(userId, day, startTime, newStartTime, newEndTime, details) {
    const event = {
        startTime: newStartTime,
        endTime: newEndTime,
        details: details
    }
    const document = await db.collection("users").doc(userId.toString()).get();
    const schedule = await document.data().schedule;
    const dayIndex = days.indexOf(day);
    const prevEvent = schedule[dayIndex].events.find((event) => event.startTime == startTime);
    if (prevEvent != undefined) {
        // Delete existing event
        const eventIndex = schedule[dayIndex].events.indexOf(prevEvent);
        schedule[dayIndex].events.splice(eventIndex, 1);
        // Insert event at new timing
        const newEventIndex = sortedIndex(schedule[dayIndex].events, newStartTime);
        schedule[dayIndex].events.splice(newEventIndex, 0, event);
    }
    await db.collection("users").doc(userId.toString()).update({schedule: schedule});
}
// Delete event.
async function deleteEvent(userId, day, startTime) {
    const document = await db.collection("users").doc(userId.toString()).get();
    const schedule = await document.data().schedule;
    const dayIndex = days.indexOf(day);
    const prevEvent = schedule[dayIndex].events.find((event) => event.startTime == startTime);
    if (prevEvent != undefined) {
        const eventIndex = schedule[dayIndex].events.indexOf(prevEvent);
        schedule[dayIndex].events.splice(eventIndex, 1);
    }
    await db.collection("users").doc(userId.toString()).update({schedule: schedule});
}
// Returns the index of array to insert the value. (To keep array sorted.)
function sortedIndex(array, value) {
    var low = 0,
        high = array.length;

    while (low < high) {
        var mid = (low + high) >>> 1;
        if (array[mid].startTime < value) low = mid + 1;
        else high = mid;
    }
    return low;
}
// Parse a time String into 24 hr time
function parseTime(time) {
    if (time.length == 4) {
        // 24 hr time
        for (i = 0; i < 4; i++) {
            if (i == 0) {
                if (time[i] < '0' || time[i] > '2') throw new Error('Invalid time input. Error in 1st number. Try again.');
            }
            if (i == 1) {
                if (time[0] == 0 || time[0] == 1)  {
                    if (time[i] < '0' || time[i] > '9') throw new Error('Invalid time input. Error in 2nd number. Try again.');
                }
                if (time[0] == 2)  {
                    if (time[i] < '0' || time[i] > '3') throw new Error('Invalid time input. Error in 2nd number. Try again.');
                }
            }
            if (i == 2) {
                if (time[i] < '0' || time[i] > '5') throw new Error('Invalid time input. Error in 3rd number. Try again.');
            }
            if (i == 3) {
                if (time[i] < '0' || time[i] > '9') throw new Error('Invalid time input. Error in 4th number. Try again.');
            }
        }
        return parseInt(time);
    } else if (time.length == 8 || time.length == 7) {
        // 12 hr time
        const hour = parseInt(time);
        if (hour < 0 || hour > 12) throw new Error('Invalid time input. Error in hours. Try again.');
        const colonIndex = time.indexOf(':');
        const temp = time.substr(colonIndex + 1);
        const minute = parseInt(temp);
        if (minute < 0 || minute > 59) throw new Error('Invalid time input. Error in minutes. Try again.');
        const ampm = time[time.length - 2];
        if (ampm != 'a' && ampm != 'A' && ampm != 'p' && ampm != 'P') throw new Error('Invalid time input. AM/PM in wrong location. Try again.');
        if (ampm == 'a' || ampm == 'A') {
            if (hour == 12) {
                return minute;
            } else {
                return hour * 100 + minute;
            }
        } else {
            if (hour == 12) {
                return hour * 100 + minute;
            } else {
                return (hour + 12) * 100 + minute;
            }
        }
    } else {
        throw new Error('Invalid time input. Incorrect number of characters. Try again.');
    }
}
// Change from 24hr time to 12hr time
function displayTime(time) {
    let hour = '';
    let minute = '';
    let ampm = '';
    if (time >= 1300) {
        ampm = 'pm';
        hour = Math.floor(time / 100) - 12;
    } else {
        if (time >= 1200) ampm = 'pm'; else ampm = 'am';
        hour = Math.floor(time / 100);
    }
    minute = time % 100;
    if (minute < 10) minute = '0' + minute;
    return hour + ':' + minute + ' ' + ampm;
}
// Return the previously entered event at that day & time. (Return undefined if no event was previously entered.)
async function getPrevEvent(userId, day, startTime) {
    const document = await db.collection("users").doc(userId.toString()).get();
    const schedule = await document.data().schedule;
    const dayIndex = days.indexOf(day);
    const prevEvent = schedule[dayIndex].events.find((event) => event.startTime == startTime);
    return prevEvent;  
}

bot.launch();