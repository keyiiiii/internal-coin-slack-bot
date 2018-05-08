const Botkit = require('botkit');
const config = require('./config');
const contract = require('./contract');
const math = require('./utils/math');

const controller = Botkit.slackbot({
  debug: false,
  json_file_store: './storage'
});

controller.spawn({
　　token: config.BOT_TOKEN,
}).startRTM(function(err, bot, payload) {
　　if (err) {
　　　　console.error('Error: Could not connect to Slack');
　　　　process.exit(1);
　　}

  /**
   * Welcome!!
   */
  controller.hears(['welcome'], 'direct_message, direct_mention, mention', (bot, message) => {
    bot.reply(message, `\`\`\`
こんにちは社内通貨ボットβです。
このボットから internal-coin（ITN）トークンを自由に送受信することができます。
使い方はこのボットにメンション or DM で \`help\` で確認することができます。
\`\`\`
    `);
  });

  /**
   * 使い方
   * help
   */
  controller.hears(['help'], 'direct_message, direct_mention, mention', (bot, message) => {
    bot.reply(message, `
- address の登録（※ ropsten の address 登録してください）
\`\`\`
add {address} 
\`\`\`
- token とメッセージを送る（TODO: 自分のアカウントには送れないようにする）
  *メッセージはブロックチェーン上に永遠に記録されます！*
\`\`\`
send \`{message}\` to @{mention}
\`\`\`
- 自分宛てに届いた最新のメッセージを見る
\`\`\`
show message
\`\`\`
- 残高確認
\`\`\`
balance
\`\`\`
- このボットの説明
\`\`\`
welcome
\`\`\`
    `);
  });

  /**
   * ropsten アドレス登録
   * `add ${address}` で address を登録する
   */
  controller.hears(['add ([a-zA-Z0-9]+)$'], 'direct_message, direct_mention, mention', (bot, message) => {
    const address = message.match[1];
    console.log('address: ', address);
    controller.storage.users.get(message.user, (getStorageErr, savedUserInfo) => {
      if (getStorageErr) {
        console.error('getStorageErr: ', getStorageErr);
      }
      const userInfo = {
        id: message.user,
        address,
      };
      console.log('userInfo: ', userInfo);

      controller.storage.users.save(userInfo, (postStorageErr, id) => {
        if (postStorageErr) {
          console.error('postStorageErr: ', postStorageErr);
        }
        bot.reply(message, `<@${id}> あなたのアドレスは *${userInfo.address}* ですね。登録しました！`);
      });

    });
  });

  /**
   * 自分宛てに届いた最新のメッセージを見る
   * `show message`
   */
  controller.hears(['show message'], 'direct_message, direct_mention, mention', (bot, message) => {
    controller.storage.users.get(message.user, (getStorageErr, savedUserInfo) => {
      if (!savedUserInfo) {
        bot.reply(message, `<@${message.user}> まず、 \`add {address}\` で wallet（ropsten）アドレスを登録してください。`);
        return;
      }
      // storage に address があればメッセージを返す
      contract.thanksMessage(savedUserInfo.address)
        .then((res) => {
          console.log('thanksMessage: ', res);
          bot.reply(message, `<@${message.user}> 直近のあなたへのメッセージ: \`${res}\``);
        });
    });
  });

  /**
   * token（とメッセージ）を送る
   * `send `${message}` to @${mention}`
   */
  controller.hears(['send `(.*)` to <@(.*)>$'], 'direct_message, direct_mention, mention', (bot, message) => {
    const sendTo = message.match[2];
    const sendMsg = message.match[1];

    controller.storage.users.get(sendTo, (getStorageErr, savedUserInfo) => {
      if (!savedUserInfo) {
        bot.reply(message, `<@${message.user}> そのユーザーのアドレスは登録されていません。`);
        return;
      }
      // TODO: 自分のアカウントには送れないようにする
      // storage に address があればメッセージを返す
      console.log(`${savedUserInfo.address} に ${sendMsg} を送る`);
      contract.thanks(savedUserInfo.address, sendMsg)
        .send({
          from: config.PARENT_ADDRESS,
        })
        .on('transactionHash', () => {
          bot.reply(message, '送信中です…');
        })
        .on('confirmation', (confirmationNumber, receipt) => {
          // 最初の1回の承認で終わりにする
          if (confirmationNumber < 1) {
            bot.reply(message, `<@${message.user}> ユーザー（<@${sendTo}>）に token と メッセージ を送りました！`);
          }
        })
        .on('error', (err) => {
          console.error('thanks error: ', err);
          bot.reply(message, `<@${message.user}> token 付与に失敗しました。`);
        });

    });
  });

  /**
   * 残高確認
   * `balance`
   */
  controller.hears(['balance'], 'direct_message, direct_mention, mention', (bot, message) => {
    controller.storage.users.get(message.user, (getStorageErr, savedUserInfo) => {
      if (!savedUserInfo) {
        bot.reply(message, `<@${message.user}> まず、 \`add {address}\` で wallet（ropsten）アドレスを登録してください。`);
        return;
      }
      contract.balanceOf(savedUserInfo.address)
        .then((res) => {
          const balance = `${math.toLocaleString(res / 1e18)} ${config.SYMBOL}`;
          console.log('balance: ', balance);
          bot.reply(message, balance);
        });
    });
  });

  /**
   * storage の中身を全部表示する
   * `get storage`
   * * debug 用 *
   */
  controller.hears(['get storage'], 'direct_message, direct_mention, mention', (bot, message) => {
    controller.storage.users.all((err, allUserData) => {
      console.log('allUserData', allUserData);
      bot.reply(message, JSON.stringify(allUserData));
    });
  });

  /**
   * storage に直接データを入れる
   * `set storage ${JSON}`
   * * debug 用 *
   */
  controller.hears(['set storage `(.*)`'], 'direct_message, direct_mention, mention', (bot, message) => {
    const string = message.match[1];
    try {
      const json = JSON.parse(string);
      controller.storage.users.save(json, (err) => {
        if (err) {
          bot.reply(message, '登録失敗しました。');
          return;
        }
        bot.reply(message, '登録しました。');
      });
    } catch (e) {
      bot.reply(message, '登録失敗しました。');
    }
  });

});