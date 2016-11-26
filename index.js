'use strict'

if (!process.env.WAKARU_SLACK_TOKEN) {
    console.log('Error: Specify token in environment');
    process.exit(1);
}

// モジュールの読み込み
var Botkit = require('botkit');
var CronJob = require('cron').CronJob;
var controller = Botkit.slackbot({
    debug: false,
});
var client = require('cheerio-httpcli');
var Twit = require('twit');
var T = new Twit({
    consumer_key: process.env.I_KNOW_BOT_TWITTER_KEY,
    consumer_secret: process.env.I_KNOW_BOT_TWITTER_SECRET,
    access_token: process.env.I_KNOW_BOT_TWITTER_TOKEN,
    access_token_secret: process.env.I_KNOW_BOT_TWITTER_TOKEN_SECRET
})

// botをSlackに接続する処理
var bot = controller.spawn({
    token: process.env.WAKARU_SLACK_TOKEN
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
            } else if (leftDays > 0 && leftDays <= 6) {
                text = '23の日まで後' + leftDays + '日です。'
            } else if (leftDays > 0 && (day - 23) % 7 === 0) {
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
        var strFaces = matches[3];
        var faces = Number(strFaces);
        if (strFaces === '') {
            if (diceType === 'D' || diceType === 'd') {
                // ダイスの場合
                faces = 6;
            } else {
                // ポテトの場合
                faces = 23;
            }
        } else if (strFaces = '0') {
            bot.reply(message, 'ダイスを振れなくて面目ない。0面だけに。');
            return;
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

// わからなくしてやるbotに投稿する
controller.hears('わからなくしてやれ',
    'direct_mention',
    function(bot, message) {
        client.fetch(process.env.WAKARANAKUSHITEYARU_URL, function(err, $, res) {
            if (err) {
                console.log(err);
                bot.reply(message, 'わからなくできませんでした');
            } else {
                var text = $('a').eq(5).text();
                bot.reply(message, 'わからなくしました\n' + text);
            }
        });
    });

// Twitterに投稿する
controller.hears('^わかる[?？]',
    'direct_mention',
    function(bot, message) {
        var matches = message.text.match(/^わかる[?？]\s+(.*)/);
        var tweet = matches[1];
        if (tweet === '') {
            bot.reply('わかろうとする内容まで入力して下さい');
            return;
        }
        T.post('statuses/update', {
            status: tweet
        }, function(err, data, response) {
            if (!err) {
                console.log(data);
                var id = data.id_str;
                var screenName = data.user.screen_name;
                var tweetURL = 'https://twitter.com/' + screenName + '/status/' + id;
                bot.reply(message, 'わかる\n' + tweetURL);
            } else {
                console.log(err);
                bot.reply(message, 'わかりませんでした');
            }
        })
    })

// Twitterで検索する
controller.hears('^ワカリサーチ',
    'direct_mention',
    function(bot, message) {
        var matches = message.text.match(/^ワカリサーチ\s+(.*)/);
        if (!matches) {
            bot.reply(message, 'ワカリサーチ対象を入力して下さい');
            return;
        }
        var query = matches[1];

        T.get('search/tweets', {
            q: query,
            count: 5
        }, function(err, data, response) {
            if (!err && data.statuses.length !== 0) {
                var tweetURLs = '';
                data.statuses.forEach(function(status) {
                    var id = status.id_str;
                    var screenName = status.user.screen_name;
                    var tweetURL = 'https://twitter.com/' + screenName + '/status/' + id;
                    tweetURLs = tweetURLs + tweetURL + '\n';
                })
                bot.reply(message, 'ワカリサーチ結果:mag_right:\n' + tweetURLs);
            } else if (data.statuses.length === 0) {
                bot.reply(message, 'ワカリサーチ結果:mag_right:\n該当なし');
            } else {
                console.log(err);
                bot.reply(message, 'ワカリサーチ失敗');
            }
        })
    })
