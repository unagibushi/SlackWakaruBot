'use strict'

if (!process.env.token) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

var Botkit = require('botkit');
var CronJob = require('cron').CronJob;
var controller = Botkit.slackbot({
    debug: false,
});

var bot = controller.spawn({
    token: process.env.token
}).startRTM(function(err, bot, payload) {

    // 23の日をお知らせする処理
    new CronJob({
        cronTime: '0 7 * * *',
        onTick: function() {
            var text = '';
            var today = new Date();
            var day = today.getDate();
            var leftDays = 23 - day;
            if (leftDays === 0) {
                text = '毎月23日は23の日です。'
            } else if (leftDays <= 6) {
                text = '23の日まで後' + leftDays + '日です。'
            } else if ((day - 23) % 7 === 0) {
                text = '23の日まで後' + (leftDays / 7) + '週間です。'
            }

            bot.say({
                channel: 'general',
                text: text,
                username: 'wakaru',
                icon_url: ''
            });
        },
        start: true,
        timeZone: 'Asia/Tokyo'
    });
});

// ダイス
controller.hears('\\d+[DdPp]\\d*',
    'ambient',
    function(bot, message) {

        var matches = message.text.match(/(\d+)([DdPp])(\d*)/i);
        var dices = Number(matches[1]);
        var diceType = matches[2];
        var faces = Number(matches[3]);
        if (faces === 0) {
            if (diceType === 'D' || diceType === 'd') {
                // ダイスの場合
                faces = 6;
            } else {
                // ポテトの場合
                faces = 23;
            }
        }
        var sum = 0;
        var pipsList = [];
        for (var i = 0; i < dices; i++) {
            var pip = '';
            pip = Math.floor(Math.random() * faces) + 1
            sum = sum + pip;
            pipsList.push(pip);
        }

        bot.reply(message, String(sum) + ' [' + pipsList.toString() + ']');

    });
