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

    // ツイート人気ランキング定期表示処理
    new CronJob({
        cronTime: '0 23 * * *',
        onTick: function() {
            getDailyRanking().then(function(result) {
                bot.say({
                    channel: 'twitter_bot',
                    text: result,
                    username: 'wakaru',
                    icon_url: ''
                });
            });
        },
        start: true,
        timeZone: 'Asia/Tokyo'
    });
});

// ダイス
controller.hears('^\\s*\\d+[DdPp]\\d*',
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
        } else if (strFaces === '0') {
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
    });

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
    });

controller.hears('^ワカリランキング',
    'direct_mention',
    function(bot, message) {
        getDailyRanking().then(function(result) {
            bot.reply(message, result);
        });
    });

// 最近１日間の理解ツイート人気ランキングを取得する
function getDailyRanking() {
    // 検索条件の準備
    var query = 'from:I_know_bot';
    var now = new Date();
    var year = now.getFullYear();
    var month = now.getMonth() + 1;
    var day = now.getDate();
    var yesterday = year + '-' + month + '-' + (day - 1);

    return T.get('search/tweets', {
            q: query,
            result_type: 'mixed',
            since: yesterday
        })
        .then(function(response) {
            if (response.data.statuses.length !== 0) {
                // 検索結果をファボ数、リツイート数でソート
                response.data.statuses.sort(function(a, b) {
                    if (a.favorite_count > b.favorite_count ||
                        a.favorite_count === b.favorite_count &&
                        a.retweet_count > b.retweet_count) {
                        return -1;
                    } else {
                        return 1;
                    }
                });

                // 検索結果を整形
                var result = ':confetti_ball: *最近１日間の理解ツイート人気ランキング*\n\n:crown:';

                var rank = 1;
                response.data.statuses.forEach(function(status) {
                    var id = status.id_str;
                    var screenName = status.user.screen_name;
                    var tweetURL = 'https://twitter.com/' + screenName + '/status/' + id;
                    var favouriteCount = status.favorite_count;
                    var retweetCount = status.retweet_count
                    result = result + '*' + rank + '位：*    ' + 'favourite: ' + favouriteCount + '    ' + 'retweet: ' + retweetCount + '\n'
                        + status.text.replace(/^/gm, '> ') + '\n'
                        + tweetURL + '\n\n';
                    rank = rank + 1;
                });
                return result;
                console.log(result);

            } else if (data.statuses.length === 0) {
                console.log('ワカリサーチ結果:mag_right:\n該当なし');
            }
        })
        .catch(function(err) {
            console.log(err);
        });
}

function fillBlanks(number, digit) {
    var strNumber = String(number);
    var result = strNumber;
    for (var i = 0; i < digit - strNumber.length; i++) {
        result = ' ' + result;
    }
    return result;
}
