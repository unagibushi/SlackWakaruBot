'use strict'

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('botkit');

var controller = Botkit.slackbot({
    debug: false,
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM();

// ダイス
controller.hears('\\d+[Dd]\\d*',
    'ambient',
    function(bot, message) {

        var matches = message.text.match(/(\d+)[Dd](\d+)/i);
        var dices = Number(matches[1]);
        var faces = Number(matches[2]);

        var sum = 0;
        var pipsList = [];
        for (var i = 0; i < dices; i++) {
            var pip = '';
            pip = Math.floor(Math.random() * faces) + 1
            sum = sum + pip;
            pipsList.push(piphttps);
        }

        bot.reply(message,String(sum) + ' [' + pipsList.toString() + ']');

    });
