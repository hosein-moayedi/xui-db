import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import fs from 'fs';
import https from "https";
import { LowSync } from "lowdb";
import { JSONFileSync } from "lowdb/node";
import moment from "moment-timezone";
import cron from 'node-cron';
import TelegramBot from "node-telegram-bot-api";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import qr from "qrcode";
import { v4 as uuidv4 } from 'uuid';

moment.tz.setDefault('Asia/Tehran');

const environment = process.env.NODE_ENV || "dev";
dotenv.config({
  path: `.env.${environment}`,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, environment == "dev" ? "./db-dev.json" : "./db-pro.json");
const adapter = new JSONFileSync(file);
const defaultData = { users: {}, orders: { waiting: {}, verified: {}, expired: {} } };
const db = new LowSync(adapter, defaultData);
db.read();

const ownerId = "1085276188"

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const plans = [
  {
    id: 103,
    name: "${SYMBOL} نامحدود     ${LIMIT_IP} کاربره   💳 ${PRICE} تومان",
    symbol: "🎖️",
    traffic: 0,
    period: 30,
    original_price: 200,
    final_price: 150,
    limit_ip: 1,
    version: 1,
    active: true,
  },
  {
    id: 96,
    name: "${SYMBOL} ${TRAFFIC} گیگ - ${LIMIT_IP} کاربره - 💳 ${PRICE} تومان",
    symbol: "🔴",
    traffic: 5,
    period: 30,
    original_price: 25,
    final_price: 15,
    limit_ip: 1,
    version: 1,
    active: false,
  },
  {
    id: 97,
    name: "${SYMBOL} ${TRAFFIC} گیگ - ${LIMIT_IP} کاربره - 💳 ${PRICE} تومان",
    symbol: "⚪️",
    traffic: 15,
    period: 30,
    original_price: 55,
    final_price: 39,
    limit_ip: 1,
    version: 1,
    active: false,
  },
  {
    id: 98,
    name: "${SYMBOL} ${TRAFFIC} گیگ     ${LIMIT_IP} کاربره   💳 ${PRICE}   تومان ",
    symbol: "🥉",
    traffic: 25,
    period: 30,
    original_price: 75,
    final_price: 59,
    limit_ip: 1,
    version: 1,
    active: true,
  },
  {
    id: 99,
    name: "${SYMBOL} ${TRAFFIC} گیگ     ${LIMIT_IP} کاربره   💳 ${PRICE}   تومان ",
    symbol: "🥈",
    traffic: 50,
    period: 30,
    original_price: 125,
    final_price: 99,
    limit_ip: 2,
    version: 1,
    active: true,
  },
  {
    id: 100,
    name: "${SYMBOL} ${TRAFFIC} گیگ     ${LIMIT_IP} کاربره   💳 ${PRICE} تومان",
    symbol: "🥇",
    traffic: 75,
    period: 30,
    original_price: 180,
    final_price: 149,
    limit_ip: 2,
    version: 1,
    active: true,
  },
  {
    id: 101,
    name: "${SYMBOL} ${TRAFFIC} گیگ   ${LIMIT_IP} کاربره   💳 ${PRICE} تومان",
    symbol: "🥇",
    traffic: 100,
    period: 30,
    original_price: 230,
    final_price: 199,
    limit_ip: 4,
    version: 1,
    active: true,
  },
  {
    id: 102,
    name: "${SYMBOL}${TRAFFIC} گیگ   ${LIMIT_IP} کاربره   💳 ${PRICE} تومان",
    symbol: "🏅",
    traffic: 200,
    period: 30,
    original_price: 420,
    final_price: 379,
    limit_ip: 4,
    version: 1,
    active: true,
  },
];

const INBOUND_ID = environment == 'dev' ? 3 : 2

const BANK_ACCOUNT = {
  OWNER_NAME: "محمد امین مویدی یکتا",
  CARD_NUMBER: 6219861911504420
}

let api = {
  nowPayment: {
    createPayment: async (orderId, amount, currency) => {
      return new Promise(async (resolve, reject) => {
        let requestData = {
          order_id: orderId,
          price_amount: amount,
          price_currency: currency,
          pay_currency: "trx",
          ipn_callback_url: "http://vpn.torgod.site/update_payment",
          is_fixed_rate: true,
        };
        const options = {
          headers: {
            "x-api-key": process.env.NOW_PAYMENT_API_KEY,
            "Content-Type": "application/json",
          },
        };
        await axios
          .post(process.env.NOW_PAYMENT_URL + "/payment", requestData, options)
          .then((response) => {
            if (response.status != 201) {
              throw `Status code should be 201 but that is ${response.status}`;
            }
            resolve(response.data);
          })
          .catch((error) => {
            reject(
              `API call error [nowPayment/createPayment]: ${error.response.data.message}`
            );
          });
      });
    },
    checkPaymentStatus: async (payment_id) => {
      return new Promise(async (resolve, reject) => {
        const options = {
          headers: {
            "x-api-key": process.env.NOW_PAYMENT_API_KEY,
            "Content-Type": "application/json",
          },
        };
        await axios
          .get(process.env.NOW_PAYMENT_URL + `/payment/${payment_id}`, options)
          .then((response) => {
            if (response.status != 200) {
              throw `Status code should be 200 but that is ${response.status}`;
            }
            resolve(response.data);
          })
          .catch((error) => {
            reject(
              `API call error [nowPayment/createPayment]: ${error.response.data.message}`
            );
          });
      });
    },
  },
  digiswap: {
    getRates: async () => {
      return new Promise(async (resolve, reject) => {
        await axios
          .get(process.env.DIGISWAP)
          .then((response) => {
            if (!response.data?.assets?.length == 2 || !response.data?.usd_buy_price) {
              throw response.data
            }
            const { assets, usd_buy_price } = response.data
            const { usd_price, transfer_fee } = assets[1]

            resolve({
              tronPrice: usd_price * usd_buy_price,
              fee: transfer_fee
            });
          })
          .catch((error) => {
            reject(`API call error [digiswap/getRates]: ${error}`);
          });
      });
    },
  },
  xui: {
    session: {},
    login: async () => {
      return new Promise(async (resolve, reject) => {
        const requestData = { username: process.env.XUI_USERNAME, password: process.env.XUI_PASSWORD };
        await axios
          .post(process.env.XUI + "/login", requestData)
          .then((response) => {
            if (!response.data.success) {
              throw response.data.msg;
            }
            const setCookieHeader = response.headers['set-cookie'][0];
            const expirationMatch = setCookieHeader.match(/Expires=([^;]+)/)
            const expires = expirationMatch ? Date.parse(expirationMatch[1]) : null;
            const token = setCookieHeader.split(';')[0].split('=')[1];
            api.xui.session = { token, expires }
            console.log('\n ✅ Connected to X-UI panel \n\n');
            resolve();
          })
          .catch((error) => {
            reject(`API call error [xui/login]: ${error}`);
          });
      });
    },
    addClient: async (inboundId, client) => {
      return new Promise(async (resolve, reject) => {
        const requestData = {
          id: inboundId,
          settings: JSON.stringify({
            clients: [client]
          })
        };
        const options = {
          headers: {
            Cookie: `session=${api.xui.session.token}=`
          }
        }
        await axios
          .post(process.env.XUI_API + "/addClient", requestData, options)
          .then((response) => {
            if (!response.data.success) {
              throw response.data.msg;
            }
            resolve();
          })
          .catch((error) => {
            reject(`API call error [xui/addClient]: ${error}`);
          });
      });
    },
    getClientInfo: async (email) => {
      return new Promise(async (resolve, reject) => {
        const options = {
          headers: {
            Cookie: `session=${api.xui.session.token}=`
          }
        }
        await axios
          .get(process.env.XUI_API + `/getClientTraffics/${email}`, options)
          .then((response) => {
            if (!response.data.success) {
              throw response.data.msg;
            }
            resolve(response.data.obj);
          })
          .catch((error) => {
            reject(`API call error [xui/getClientInfo]: ${error}`);
          });
      });
    },
    depletedClients: async () => {
      return new Promise(async (resolve, reject) => {
        const options = {
          headers: {
            Cookie: `session=${api.xui.session.token}=`
          }
        }
        await axios
          .post(process.env.XUI_API + `/delDepletedClients/${INBOUND_ID}`, null, options)
          .then((response) => {
            if (!response.data.success) {
              throw response.data.msg;
            }
            resolve();
          })
          .catch((error) => {
            reject(`API call error [xui/depletedClients]: ${error}`);
          });
      });
    },
  },
  db: async (query) => {
    return new Promise(async (resolve, reject) => {
      const options = {
        headers: {
          "Content-Type": "application/json",
        },
      };
      await axios
        .post(process.env.XUI_DB_API, { query }, options)
        .then((response) => {
          resolve(response.data);
        })
        .catch((error) => {
          reject(
            `API call error [db]: ${error.response.data.message}`
          );
        });
    });
  },
};

const vpn = {
  addConfig: async (userId, orderId, plan) => {
    const config = vpn.createConfigObj(userId, orderId, plan.traffic, plan.period, plan.limit_ip)
    await api.xui.addClient(INBOUND_ID, config)
    return { inbound_id: INBOUND_ID, ...config }
  },
  addTestConfig: async (userId) => {
    const testConfig = vpn.createConfigObj(userId, null, 2, 0.041, 1, true)
    await api.xui.addClient(INBOUND_ID, testConfig)
    return { inbound_id: INBOUND_ID, ...testConfig }
  },
  createConfigObj: (userId, orderId, traffic, period, limitIp, isTest = false) => {
    const uuid = uuidv4()
    const expiryTime = moment().add(period * 24 * 60 * 60 * 1000).valueOf()
    return {
      alterId: 0,
      email: `${userId}-${isTest ? "test" : orderId}`,
      enable: true,
      expiryTime,
      id: uuid,
      flow: 'xtls-rprx-vision',
      limitIp,
      subId: isTest ? `test-${userId}` : orderId,
      tgId: "",
      totalGB: traffic * 1024 * 1024 * 1024
    }
  },
  getSubLink: (subId) => {
    return `${process.env.REALEY_SUB}/${subId}`
  }
}

let cooldowns = {};
const COOLDOWN_PERIOD = 1000;

const buttons = {
  mainMenu: [
    ["🛍️ خرید سرویس"],
    ["🔮 سرویس‌ های فعال", "🎁 تست نامحدود و رایگان",],
    ["🔰 آموزش اتصال"],
    ["☎️ پشتیبانی", "🫂 پشتیبانی فنی"],
  ],
  education: [
    [{
      text: '🍀 اندروید - Hiddify ✨',
      url: 'https://telegra.ph/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-%D8%A7%D9%86%D8%AF%D8%B1%D9%88%DB%8C%D8%AF-%D8%A8%D8%A7-HiddifyNG-07-29'
    }],
    [{
      text: '🍀 اندروید - V2rayNG 🍭',
      url: 'https://telegra.ph/%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-%D8%A7%D9%86%D8%AF%D8%B1%D9%88%DB%8C%D8%AF-%D8%A8%D8%A7-V2rayNG-07-29'
    }],
    [{
      text: '🍎 آی او اس - V2Box 🗳️',
      url: 'https://telegra.ph/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-IOS-%D8%A8%D8%A7-%D9%86%D8%B1%D9%85-%D8%A7%D9%81%D8%B2%D8%A7%D8%B1-V2Box-07-29'
    }],
    [{
      text: '🖥️ ویندوز - V2rayN 💫',
      url: 'https://t.me/nova_vpn_channel/24'
    }],
    [{
      text: '💻 مک او اس - V2Box 🗳️',
      url: 'https://t.me/nova_vpn_channel/93'
    }]
  ]
}

let images = {
  gift: "",
  os: "",
  support: "",
  welcome: "",
  cart: "",
  hiddify: ""
}

const initImages = async () => {
  const assetsPath = './assets/img'
  for (const img in images) {
    const buffer = await readImageAsBuffer(`${assetsPath}/${img}.jpg`)
    images[img] = buffer
  }
}

const isOnCooldown = (userId) => {
  if (cooldowns[userId] && cooldowns[userId] > moment().valueOf())
    return true;
  cooldowns[userId] = moment().valueOf() + COOLDOWN_PERIOD;
  return false;
}

const cleanExpiredCooldown = () => {
  const cooldownUsers = Object.getOwnPropertyNames(cooldowns)
  cooldownUsers.map((cooldownUserId) => {
    if (cooldowns[cooldownUserId] < moment().valueOf())
      delete cooldowns[cooldownUserId]
  })
}

const checkOrdersTimeout = () => {
  try {
    const { orders } = db.data
    let userId, messageId
    for (const orderId in orders.waiting) {
      const order = orders.waiting[orderId];
      if (order.payment_limit_time < moment().valueOf()) {
        [userId, messageId] = [order.user_id, order.message_id]
        delete order.message_id
        orders.expired[order.id] = { ...order }
        delete orders.waiting[orderId]
        bot.deleteMessage(userId, messageId);
        bot.sendMessage(userId, `🫠 متاسفانه زمان انجام تراکنش برای سرویس ${orderId} به اتمام رسید.\n\n😇 لطفا از منو زیر مجددا اقدام به خرید سرویس بفرمایید 👇`, { parse_mode: "HTML" })
        db.write()
      }
    }
  } catch (err) {
    console.error("❌ Error: checkOrdersTimeout> ", err);
  }
}

const cleanExpiredOrders = () => {
  try {
    const { orders } = db.data
    for (const orderId in orders.expired) {
      const { payment_limit_time } = orders.expired[orderId];
      if (payment_limit_time + 172800000 < moment().valueOf()) {
        delete orders.expired[orderId]
        db.write()
      }
    }
  } catch (err) {
    console.error("❌ Error: cleanExpiredOrders> ", err);
  }
}

const cleanExpiredConfigs = async () => {
  try {
    await api.xui.depletedClients()
  } catch (err) {
    console.log("Error in cleanExpiredConfigs >> ", err);
  }
}

const checkConfigsExpiration = async () => {
  // try {
  //   const query = `SELECT email, up, down, total, expiry_time FROM client_traffics WHERE inbound_id=${INBOUND_ID} AND enable=1`;
  //   const rows = await api.db(query)
  //   const configs = [...rows];
  //   if (configs.length > 0) {
  //     configs.map(async ({ email, up, down, total, expiry_time }) => {
  //       const [userId, orderId] = email.split('-')




  //       const { plan, paid_at, expire_at } = db.data.orders.verified[orderId]
  //       let remainingTraffic = ((total - up - down) / 1024 / 1024 / 1024).toFixed(2)
  //       remainingTraffic = remainingTraffic > 0 ? remainingTraffic : 0
  //       const subLink = vpn.getSubLink(orderId)
  //       const { fastConfig, stableConfig } = await getConfigFromSub(subLink)
  //       const fastConfigQR = await qrGenerator(fastConfig)
  //       const stableConfigQR = await qrGenerator(stableConfig)
  //       bot.sendMediaGroup(from.id,
  //         [
  //           {
  //             type: 'photo',
  //             media: fastConfigQR,
  //           }, {
  //             type: 'photo',
  //             media: stableConfigQR,
  //             caption: `🛍️ <b>شماره سرویس: </b>${orderId}\n🪫 <b>حجم باقیمانده: </b>${remainingTraffic} گیگ\n⏱️ <b>تاریخ تحویل: </b>${paid_at.slice(0, 10)}\n📅 <b>تاریخ انقضا: </b>${expire_at.slice(0, 10)}\n${plan.limit_ip > 1 ? "👥" : "👤"} <b>نوع طرح: </b>${plan.limit_ip} کاربره\n\n👀 <b>وضعیت سرویس: ${enable ? '✅ فعال' : '❌ غیر فعال'}</b>${enable ? `\n\n🚀 <b>کانفیگ - پرسرعت:</b> (روی کانفیگ بزنید تا کپی شود 👇)\n\n<code>${fastConfig}</code>\n\n\n✨ <b>کانفیگ - همیشه متصل:</b> (روی کانفیگ بزنید تا کپی شود 👇)\n\n<code>${stableConfig}</code>` : ''}`,
  //             parse_mode: "HTML",

  //           }
  //         ],
  //       );
  //     })
  //   }
  // } catch (err) {
  //   console.log(err);
  //   bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی در دریافت سرویس های شما پیش اومده\n\n😇 لطفا بعد از چند دقیقه دوباره تلاش کنید.");
  // }
}

const qrGenerator = async (text) => {
  try {
    const buffer = await new Promise((resolve, reject) => {
      qr.toBuffer(text, (err, buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(buffer);
        }
      });
    });
    return buffer
  } catch (err) {
    console.error('Error generating or saving QR code:', err);
  }
}

const readImageAsBuffer = async (filePath) => {
  try {
    const buffer = await fs.promises.readFile(filePath, 'binary');
    return Buffer.from(buffer, 'binary');
  } catch (err) {
    console.error('Error reading the image:', err);
    return null;
  }
}

const baseChecking = async (userId, isStartCommand) => {
  if (isOnCooldown(userId)) return false
  if (!isStartCommand) {
    const user = db.data.users[userId]
    if (!user) {
      bot.sendMessage(userId, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی پیش اومده\n\n😇 لطفا بر روی /start بزنید.");
      return false
    }
  }
  // try {
  //   const channelSubscription = await bot.getChatMember('@nova_vpn_channel', userId)
  //   if (channelSubscription.status !== 'member' && channelSubscription.status !== 'creator' && channelSubscription.status !== 'administrator') {
  //     bot.sendPhoto(userId, images.welcome,
  //       {
  //         caption: `😇 به سرویس NOVA خوش آمدید 🌹\n\nلطفا جهت استفاده از ربات، ابتدا در کانال ما عضو شده و سپس بر روی 👈 /start 👉 ضربه بزنید`,
  //         reply_markup: {
  //           inline_keyboard: [
  //             [{ text: "🪐 NOVA کانال اطلاع رسانی 📣", url: "https://t.me/nova_vpn_channel" }]
  //           ]
  //         }, parse_mode: 'HTML'
  //       }
  //     );
  //     return false
  //   }
  // } catch (err) {
  //   console.error('Error:', err);
  //   return false
  // }
  return true
}

const getConfigFromSub = async (subLink) => {
  try {
    let response = await axios.get(subLink)
    let content = Buffer.from(response.data, 'base64')
    content = content.toString('utf-8')
    const [fastConfig, stableConfig] = content.split('\n\n')
    return { stableConfig, fastConfig }
  } catch (err) {
    console.log(err);
  }
}

bot.onText(/\/start/, async ({ from }) => {
  if (from.is_bot)
    return;
  const baseCheckingStatus = await baseChecking(from.id, true)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id];
  if (!user) {
    db.data.users[from.id] = {
      id: from.id,
      tg_name: from.first_name,
      tg_username: from.username,
      tested: false,
      created_at: moment().format().slice(0, 19)
    }
    db.write();
  }
  try {
    bot.sendPhoto(from.id, images.gift, {
      caption: "😇 به ربات <b>NOVA</b> خوش آمدید 🌹\n\n🎁 جهت دریافت تست <b>نامحدود و رایگان</b>، از منوی زیر اقدام بفرمایید 👇",
      reply_markup: JSON.stringify({
        keyboard: buttons.mainMenu,
        resize_keyboard: true,
      }),
      parse_mode: 'HTML'
    });
  } catch (err) {
    console.log('err: ', err);
  }
});

bot.onText(/ok/, async ({ from, text }) => {
  const baseCheckingStatus = await baseChecking(from.id, true)
  if (!baseCheckingStatus) return

  if (from.id == ownerId) {
    const { orders } = db.data
    try {
      const pattern = /ok\s(\d{1,3}(,\d{3})*)/;
      const match = text.match(pattern);
      const price = match[1]
      for (const orderId in orders.waiting) {
        const order = orders.waiting[orderId];
        if (order.amount == price.replace(/\,/g, '')) {
          const [userId, messageId] = [order.user_id, order.message_id]
          delete order.message_id
          order.trashMessages.map((msgId) => {
            bot.deleteMessage(userId, msgId);
          })
          delete order.trashMessages
          orders.verified[order.id] = { ...order, paid_at: moment().format().slice(0, 19) }
          delete orders.waiting[orderId]
          bot.deleteMessage(userId, messageId);
          db.write()
          const config = await vpn.addConfig(userId, orderId, order.plan)
          const subLink = vpn.getSubLink(config.subId)
          const { fastConfig, stableConfig } = await getConfigFromSub(subLink)
          const fastConfigQR = await qrGenerator(fastConfig)
          const stableConfigQR = await qrGenerator(stableConfig)
          bot.sendMediaGroup(userId,
            [
              {
                type: 'photo',
                media: fastConfigQR,
              }, {
                type: 'photo',
                media: stableConfigQR,
                caption: `✅ تراکنش شما با موفقیت تایید شد.\n\n🛍️ <b>شماره سرویس: </b>${order.id}\n🔋 <b>حجم: </b>${order.plan.traffic > 0 ? `${order.plan.traffic} گیگ`: 'نامحدود'}\n⏰ <b>مدت: </b>${order.plan.period} روزه\n${order.plan.limit_ip > 1 ? "👥" : "👤"}<b>نوع طرح: </b>${order.plan.limit_ip} کاربره\n💳 <b>هزینه پرداخت شده: </b>${(order.amount).toLocaleString()} ریال\n\n🚀 <b>کانفیگ - پرسرعت:</b> (روی کانفیگ بزنید تا کپی شود 👇)\n\n<code>${fastConfig}</code>\n\n\n✨ <b>کانفیگ - همیشه متصل:</b> (روی کانفیگ بزنید تا کپی شود 👇)\n\n<code>${stableConfig}</code>`,
                parse_mode: "HTML",

              }
            ],
          );
          setTimeout(() => {
            bot.sendMessage(userId, 'لینک دانلود آخرین نسخه نرم افزار ها به همراه آموزش نحوه اتصال بر اساس سیستم عامل شما در پایین قرار داده شده 👇',
              {
                parse_mode: 'HTML',
                reply_markup: JSON.stringify({
                  inline_keyboard: buttons.education,
                  resize_keyboard: true,
                }),
              })
          }, 500)
          bot.sendMessage(from.id, '✅ Done ✅')
          return
        }
      }
      bot.sendMessage(from.id, '⚠️ Not Found ⚠️')
    } catch (err) {
      console.error("❌ Error: config_generation> ", err);
      bot.sendMessage(from.id, '❌ Failed ❌')
    }
  }
});

bot.onText(/msg/, async ({ from, text }) => {
  const baseCheckingStatus = await baseChecking(from.id, true)
  if (!baseCheckingStatus) return

  if (from.id == ownerId) {
    const { users } = db.data
    try {
      // Extracting everything between "-" and ":"
      const regexRecipient = /msg\s(.*?)::/;
      const matchRecipient = text.match(regexRecipient);
      const recipient = matchRecipient ? matchRecipient[1].trim() : '';

      // Extracting everything after the last ":"
      const regexMessage = /(?<=::)(.*)/s;
      const matchMessage = text.match(regexMessage);
      const message = matchMessage ? matchMessage[0].trim() : '';

      if (recipient && message) {
        switch (recipient) {
          case "all":
            for (const userId in users) {
              bot.sendMessage(userId, message)
            }
            bot.sendMessage(from.id, `✅ <b>The message was sent</b> ✅\n\n📫 <b>Recipients</b>: ${recipient}\n\n✉️ <b>Message:</b>\n\n${message}`, { parse_mode: "HTML" })
            break;

          case "sub":
            const query = `SELECT email FROM client_traffics WHERE inbound_id=${INBOUND_ID} AND email LIKE '%-%' AND email NOT LIKE '%-test'`;
            let rows = await api.db(query)
            if (rows.length == 0) {
              bot.sendMessage(from.id, '⚠️ There is no any sub user! ⚠️')
              return
            }
            const recipients = []
            rows.map(({ email }) => {
              const userId = email.split('-')[0]
              if (!recipients.find((item) => item == userId)) {
                recipients.push(userId)
              }
            })
            let botMsgToAdmin = `✅ <b>The message was sent</b> ✅\n\n📫 <b>Recipients:</b>\n\n`
            recipients.map((userId) => {
              const userInfo = users[userId]
              bot.sendMessage(userInfo.id, message)
              botMsgToAdmin = botMsgToAdmin + `\nid: ${userInfo.id}\nusername: @${userInfo.tg_username || 'none'}\nname: ${userInfo.tg_name}\n-----------------------------`
            })
            botMsgToAdmin = botMsgToAdmin + `\n\n\n👥 <b>Total Recipients: </b>${recipients.length}\n\n`
            botMsgToAdmin = botMsgToAdmin + `✉️ <b>Message:</b>\n\n${message}`
            bot.sendMessage(from.id, botMsgToAdmin, { parse_mode: "HTML" })
            break;

          default:
            const targets = recipient.split(',')
            let notValid = false
            targets.map((targetId) => {
              if (!notValid && !users[targetId]) {
                notValid = true
              }
            })
            if (notValid) {
              bot.sendMessage(from.id, '⚠️ Target user not found! ⚠️')
              return
            }
            let botMsg = `✅ <b>The message was sent</b> ✅\n\n📫 <b>Recipients:</b>\n\n`
            targets.map((targetId) => {
              const userInfo = users[targetId]
              bot.sendMessage(targetId, message, { parse_mode: 'HTML' })
              botMsg = botMsg + `\nid: ${userInfo.id}\nusername: @${userInfo.tg_username || 'none'}\nname: ${userInfo.tg_name}\n-----------------------------`
            })
            botMsg = botMsg + `\n\n\n👥 <b>Total Recipients: </b>${targets.length}\n\n`
            botMsg = botMsg + `✉️ <b>Message:</b>\n\n${message}`
            bot.sendMessage(from.id, botMsg, { parse_mode: "HTML" })
            break;
        }
      }
    } catch (err) {
      console.error("❌ Error: Sending message> ", err);
      bot.sendMessage(from.id, '❌ Failed to send message ❌')
    }
  }
});

bot.onText(/🎁 تست نامحدود و رایگان/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (user.tested) {
    bot.sendMessage(
      from.id,
      "🙃 شما قبلا کانفیگ تست را دریافت نموده‌اید.\n\n😇 لطفا درصورت رضایت از کیفیت سرویس، از منو پایین اقدام به خرید سرویس بفرمایید 👇"
    );
    return;
  }
  try {
    const { subId } = await vpn.addTestConfig(user.id)
    const subLink = vpn.getSubLink(subId)
    const { stableConfig, fastConfig } = await getConfigFromSub(subLink)
    user.tested = true
    db.write()
    bot.sendMessage(from.id, `✅ کانفیگ تست شما با موفقیت ساخته شده\n\n🎁 <b>حجم: </b>نامحدود\n⏰ <b>مدت استفاده: </b>۱ ساعت\n\n🚀 <b>کانفیگ - پرسرعت:</b> (روی کانفیگ بزنید تا کپی شود 👇)\n\n<code>${fastConfig}</code>\n\n\n✨ <b>کانفیگ - همیشه متصل:</b> (روی کانفیگ بزنید تا کپی شود 👇)\n\n<code>${stableConfig}</code>\n\n‼️ <u><b>لطفا بر اساس سیستم عامل خود یکی از نرم افزارها را انتخاب کرده و تمامی مراحل را با دقت انجام دهید</b></u> ‼️`,
      {
        parse_mode: "HTML",
        reply_markup: JSON.stringify({
          inline_keyboard: buttons.education,
          resize_keyboard: true,
        }),
      },
    );
    if (user.id != ownerId) {
      setTimeout(() => {
        bot.sendMessage(ownerId,
          `🔔 <b>New user created test</b> 🔔\n\n🗣️ <code>${user.tg_name}</code>  ${user.tg_username && ` 👋 <code>${user.tg_username}</code> `}  🎗️ <code>${user.id}</code>`,
          { parse_mode: 'HTML' }
        )
      }, 900)
    }
  } catch (e) {
    console.error("❌ Error: test_config_generation> ", e);
    bot.sendMessage(from.id, "🤕 اواو!\n🤔 فکر کنم یه مشکلی پیش اومده\n\n😇 لطفا بعد از چند دقیقا مجددا تلاش کنید");
  }
});

bot.onText(/🛍️ خرید سرویس/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی پیش اومده\n\n😇 لطفا بر روی /start بزنید.");
    return
  }
  bot.sendMessage(
    from.id,
    `😇 جهت اطمینان، حتما از منو اصلی اقدام به "<b>🎁 تست نامحدود و رایگان</b>" بفرمایید.\n\n😊 جهت ادامه خرید بر روی دکمه زیر بزنید.`,
    {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            {
              text: "🛍️ ادامه خرید",
              callback_data: JSON.stringify({ action: "features" }),
            },
          ],
        ],
      }),
      parse_mode: "HTML"
    },
  );
});

bot.onText(/🔮 سرویس‌ های فعال/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی پیش اومده\n\n😇 لطفا بر روی /start بزنید.");
    return
  }

  try {
    const query = `SELECT email, up, down, total, enable FROM client_traffics WHERE inbound_id=${INBOUND_ID} AND email LIKE '${user.id}-%' AND email NOT LIKE '%-test'`;
    const rows = await api.db(query)
    const configs = [...rows];
    if (configs.length == 0) {
      bot.sendMessage(from.id, "🫠 در حال حاضر هیچ سرویس فعالی ندارید\n\n🛍️ جهت خرید از منو پایین اقدام بفرمایید 👇");
      return
    }
    configs.map(async ({ email, up, down, total, enable }) => {
      const orderId = email.split('-')[1]
      const { plan, paid_at, expire_at } = db.data.orders.verified[orderId]
      let remainingTraffic = ((total - up - down) / 1024 / 1024 / 1024).toFixed(2)
      remainingTraffic = remainingTraffic > 0 ? remainingTraffic : 0
      const subLink = vpn.getSubLink(orderId)
      const { fastConfig, stableConfig } = await getConfigFromSub(subLink)
      const fastConfigQR = await qrGenerator(fastConfig)
      const stableConfigQR = await qrGenerator(stableConfig)
      bot.sendMediaGroup(from.id,
        [
          {
            type: 'photo',
            media: fastConfigQR,
          }, {
            type: 'photo',
            media: stableConfigQR,
            caption: `🛍️ <b>شماره سرویس: </b>${orderId}\n🪫 <b>حجم باقیمانده: </b>${total > 0 ? `${remainingTraffic} گیگ`: 'نامحدود'}\n⏱️ <b>تاریخ تحویل: </b>${paid_at.slice(0, 10)}\n📅 <b>تاریخ انقضا: </b>${expire_at.slice(0, 10)}\n${plan.limit_ip > 1 ? "👥" : "👤"} <b>نوع طرح: </b>${plan.limit_ip} کاربره\n\n👀 <b>وضعیت سرویس: ${enable ? '✅ فعال' : '❌ غیر فعال'}</b>${enable ? `\n\n🚀 <b>کانفیگ - پرسرعت:</b> (روی کانفیگ بزنید تا کپی شود 👇)\n\n<code>${fastConfig}</code>\n\n\n✨ <b>کانفیگ - همیشه متصل:</b> (روی کانفیگ بزنید تا کپی شود 👇)\n\n<code>${stableConfig}</code>` : ''}`,
            parse_mode: "HTML",

          }
        ],
      );
    })
  } catch (err) {
    console.log(err);
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی در دریافت سرویس های شما پیش اومده\n\n😇 لطفا بعد از چند دقیقه دوباره تلاش کنید.");
  }
});

bot.onText(/🔰 آموزش اتصال/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const botMsg = '‼️ <u><b>حتما از آخرین نسخه نرم افزارها استفاده کنید</b></u> ‼️\n\n👇بر اساس سیستم عامل خود یکی از نرم افزارهای زیر را انتخاب کنید👇'
  bot.sendMessage(from.id, botMsg, {
    reply_markup: {
      inline_keyboard: buttons.education,
    },
    parse_mode: "HTML"
  });
});

bot.onText(/🫂 پشتیبانی فنی/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی پیش اومده\n\n😇 لطفا بر روی /start بزنید.");
    return
  }
  const botMsg = `😇 <b>لطفا ابتدا موارد زیر را بررسی بفرمایید 👇</b>\n\n1️⃣ از بخش "🔮سرویس‌های فعال" حجم و زمان باقی مانده سرویس را بررسی کنید.\n\n2️⃣ اتصال به اینترنت را بدون استفاده از vpn چک بفرمایید.\n\n3️⃣ ترجیحا از نرم افزارهایی که در کانال معرفی شده استفاده کنید.\n\n4️⃣ در نرم افزار v2rayNG طبق آموزش مقدار allowInsecure را true کنید.\n\n😇 در صورتی که همچنان در اتصال به سرویس مشکل دارید میتوانید به پشتیبانی پیام دهید 👇`
  bot.sendMessage(from.id, botMsg,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "☎️ پشتیبان فنی", url: "https://t.me/nova_vpn_support" }]]
      }, parse_mode: "HTML"
    }
  );
});

bot.onText(/☎️ پشتیبانی/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const botMsg = `✅ جهت تایید تراکنش، لطفا رسید خود را برای <u><b>پشتیبانی</b></u> ارسال بفرمایید 👇`;
  bot.sendPhoto(from.id, images.support, {
    caption: botMsg,
    reply_markup: {
      inline_keyboard: [[{ text: "☎️ پشتیبان", url: "t.me/nova_vpn_support" }]]
    },
    parse_mode: "HTML",
    disable_web_page_preview: true
  });
});

bot.on("callback_query", async (query) => {
  const { message, from, data } = query;
  if (isOnCooldown(from.id)) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی پیش اومده\n\n😇 لطفا بر روی /start بزنید.");
    return
  }
  const chatId = from.id;
  const messageId = message.message_id;
  const queryData = JSON.parse(data);

  if (queryData.action === "check_channel_subscription") {
    baseChecking(chatId)
  }

  if (queryData.action === "features") {
    const botMsg =
      `✅ <b>مزایای تمامی سرویس های 🪐 NOVA</b>\n\n💥 دور زدن اینترنت ملی\n💥 مناسب تمامی اپراتور ها\n💥 پشتیبانی از تمامی سیستم عامل ها\n💥مخصوص دانلود با سرعت بالا\n💥 رنج آی پی ثابت\n\n👇 جهت ادامه خرید، کلیک کنید 👇`;
    bot.editMessageText(botMsg, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: [[{
          text: "🛍️ مشاهده سرویس ها", callback_data: JSON.stringify({
            action: "store",
          })
        }]]
      },
      parse_mode: "HTML"
    });
  }

  if (queryData.action === "store") {
    const botMsg =
      `<b>‼️ تمامی سرویس ها 30 روزه میباشد ‼️</b>\n\n🔻 سرویس مورد نظر خود را انتخاب کنید🔻`;
    bot.editMessageText(botMsg, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: plans.map((item) => {
          if (item.active) {
            return [
              {
                text: item.name
                  .replace("${TRAFFIC}", item.traffic)
                  .replace("${LIMIT_IP}", item.limit_ip)
                  .replace("${SYMBOL}", item.symbol)
                  .replace("${PRICE}", item.final_price),
                callback_data: JSON.stringify({
                  action: "plan_detailes",
                  data: { planId: item.id },
                }),
              },
            ];
          }
          return []
        }),
      },
      parse_mode: "HTML"
    });
  }

  if (queryData.action === "plan_detailes") {
    const plan = plans.find((item) => item.id == queryData.data.planId);

    const botMsg = `${plan.limit_ip > 1 ? "👥" : "👤"} <b>نوع طرح: </b>${plan.limit_ip} کاربره\n\n${plan.symbol} <b>حجم:</b> ${plan.traffic > 0 ? `${plan.traffic} گیگ`: 'نامحدود'}\n\n⏰ <b>مدت:</b> ${plan.period} روزه\n\n🎁 <b>قیمت:</b> <s>${plan.original_price} تومان</s>  ⬅️ <b>${plan.final_price} تومان</b> 🎉\n\n😊 برای خرید نهایی روی دکمه "✅ صدور فاکتور" کلیک کنید.`

    bot.editMessageText(botMsg, {
      chat_id: chatId,
      message_id: messageId,
      parse_mode: "HTML",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: "⬅️ بازگشت",
              callback_data: JSON.stringify({ action: "store" }),
            },
            {
              text: "✅ صدور فاکتور",
              callback_data: JSON.stringify({
                action: "generate_order",
                data: { planId: plan.id },
              }),
            },
          ],
        ],
      },
    });
  }

  if (queryData.action === "generate_order") {
    const plan = plans.find((item) => item.id == queryData.data.planId);
    try {
      const orderId = Math.floor(Math.random() * (999999999 - 100000000 + 1)) + 100000000;
      const amount = (plan.final_price * 10000) - Math.floor(Math.random() * 1000);
      const paymentLimitTime = moment().add(3600000) // 1 hour

      const order = {
        id: orderId,
        user_id: from.id,
        message_id: messageId,
        trashMessages: [],
        plan: {
          ...plan,
          name: plan.name
            .replace("${TRAFFIC}", plan.traffic)
            .replace("${LIMIT_IP}", plan.limit_ip)
            .replace("${SYMBOL}", plan.symbol)
            .replace("${PRICE}", plan.final_price),
        },
        amount,
        created_at: moment().format().slice(0, 19),
        expire_at: moment().add(plan.period * 24 * 60 * 60 * 1000).format().slice(0, 19),
        payment_limit_time: paymentLimitTime.valueOf()
      };
      db.data.orders.waiting[orderId] = order;
      db.write();

      bot.editMessageText(
        `🛍️ <b>شماره سرویس: </b>${orderId}\n\n💳 <b>مبلغ نهایی: </b>\n<code>${amount.toLocaleString()}</code> ریال 👉 (روی اعداد ضربه بزنید تا کپی شود)\n\n🏦 <b>شماره کارت: </b>\n<code>${BANK_ACCOUNT.CARD_NUMBER}</code> 👉 (ضربه بزنید تا کپی شود)\n\n👤 <b>صاحب حساب: </b> ${BANK_ACCOUNT.OWNER_NAME}\n\n⚠️ <b>مهلت پرداخت: </b> تا ساعت <u><b>${paymentLimitTime.format().slice(11, 16)}</b></u> ⚠️\n\n‼️ <u><b>توجه: از رند کردن مبلغ نهایی خودداری کنید </b></u>‼️\n\n✅ جهت تکمیل خرید سرویس، مبلغ <u><b>دقیق</b></u> بالا را به شماره کارت ذکر شده واریز بفرمایید و رسید خود را برای <u><b>پشتیبانی</b></u> ارسال کنید 👇`,
        {
          parse_mode: "HTML",
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [[
              {
                text: "☎️ پشتیبانی",
                url: "https://t.me/nova_vpn_support",
              }
            ]]
          },
        }
      );
    } catch (e) {
      console.error("❌ Error: invoice_generation> ", e);
      bot.editMessageText(
        "❌ عملیات صدور فاکتور با خطا مواجه شد\n🙏 لطفا دوباره تلاش کنید",
        {
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "♻️ تلاش مجدد",
                  callback_data: JSON.stringify({
                    action: "generate_order",
                    data: { planId: plan.id },
                  }),
                },
              ],
              [
                {
                  text: "⬅️ بازگشت",
                  callback_data: JSON.stringify({ action: "store" }),
                },
              ],
            ],
          },
        }
      );
    }
  }

  if (queryData.action === 'education') {
    switch (queryData.data.device) {
      case 'android':
        bot.sendPhoto(chatId, images.hiddify, {
          caption: '‼️ <b>آخرین نسخه هیدیفای را نصب کنید</b>\n\n👈 <b><a href="http://turbo.torgod.site/softwares/HiddifyNG.apk">(دریافت آخرین نسخه هیدیفای)</a> 👉</b>\n\n🔰 طبق آموزش داخل عکس عمل کنید',
          parse_mode: "HTML"
        })
        break;

      default:
        break;
    }
  }
});

bot.on("polling_error", (error) => {
  console.log(error);
});

app.get("/bot_status", (req, res) => {
  res.send("🚀 Bot is running ✅");
});

app.get("/sub/:order_id", async (req, res) => {
  try {
    let response = await axios.get(`${process.env.XUI_SUB}/${req.params.order_id}`)
    let content = Buffer.from(response.data, 'base64')
    content = content.toString('utf-8')
    content = content.replace(/@([^:]+)/, '@nova.torgod.site').replace(/#.*/, "#%E2%9A%A1%EF%B8%8F%20Fast%20NOVA")
    content = content + '\n' + content.replace(/@([^:]+)/, '@turbo.torgod.site').replace(/#.*/, '#%E2%9C%A8%20Stable%20NOVA')
    content = btoa(content)
    res.setHeader('Content-Type', response.headers['content-type']);
    res.setHeader('Profile-Title', response.headers['profile-title']);
    res.setHeader('Profile-Update-Interval', response.headers['profile-update-interval']);
    res.setHeader('Subscription-Userinfo', response.headers['subscription-userinfo']);
    res.status(200).send(content);
  } catch (err) {
    console.log(err);
  }
});

app.post("/c2c-transaction-verification", async (req, res) => {
  // const { content, secret_key } = req.body
  // if (secret_key !== process.env.C2C_TRANSACTION_VERIFICATION_SECRET_KEY) {
  //   res.status(403).json({ msg: "invalid secretkey!", success: false });
  //   return
  // }
  // console.log("content: ", content);

  // let formattedMessage = "";
  // for (let i = 0; i < content.length; i += 4) {
  //   formattedMessage += "\\u" + content.substr(i, 4);
  // }
  // console.log(formattedMessage);

  // const persianText = formattedMessage.replace(/\\u([\d\w]{4})/gi, (match, grp) => {
  //   return String.fromCharCode(parseInt(grp, 16));
  // });
  // console.log(persianText);

  // const bankRegex = /بلو\nواریز پول\n محمدحسین عزیز، ([\d,]+)/;

  // const bankMatch = persianText.match(bankRegex);

  // if (bankMatch) {
  //   let price = bankMatch[1];
  //   console.log(price.replace(/\,/g, ''));

  //   const { orders } = db.data
  //   let userId, messageId

  //   try {
  //     for (const orderId in orders.waiting) {
  //       const order = orders.waiting[orderId];
  //       if (order.amount == price.replace(/\,/g, '')) {
  //         [userId, messageId] = [order.user_id, order.message_id]
  //         delete order.message_id
  //         orders.verified[order.id] = { ...order, paid_at: moment().format().slice(0, 19) }
  //         delete orders.waiting[orderId]
  //         bot.deleteMessage(userId, messageId);

  //         const config = await vpn.addConfig(userId, orderId, order.plan)
  //         db.data.users[userId].configs.push({
  //           ...config,
  //           orderId: order.id
  //         })
  //         db.write()
  //         const subLink = vpn.getSubLink(config.subId)
  //         bot.sendMessage(userId, `✅ پرداخت شما برای سفارش ${orderId} با موفقیت تایید شد.\n\n😇 ابتدا بر روی لینک آپدیت زیر کلیک کرده تا کپی شود و سپس برای مشاهده نحوه اتصال، در منو اصلی ربات بر روی دکمه <b>«👨🏻‍🏫 آموزش اتصال»</b> کلیک کنید\n\n<code>${subLink}</code>`, { parse_mode: "HTML" });
  //         res.status(200).json({ msg: "verified", success: true });
  //         return
  //       }
  //     }
  //   } catch (err) {
  //     console.error("❌ Error: config_generation> ", err);
  //     bot.sendMessage(userId, "❌ متاسفانه مشکلی در تایید پرداخت یا ساخت کانفیگ به وجود آمده. لطفا به پشتیبانی پیام دهید 🙏");
  //   }
  // } else {
  //   console.log('No match found.');
  // }

  // res.status(404).json({ msg: "transaction not found!", success: false });
});

const checkXUISessionExpiration = () => {
  if (api.xui.session && api.xui.session.expires) {
    const currentTime = Date.now();
    const expirationTime = api.xui.session.expires;
    if (currentTime >= expirationTime - 2160000000) {
      api.xui.login()
    }
  }
}

const port = process.env.PORT || 9090;
const certOptions = {
  key: fs.readFileSync('./certs/turbo.torgod.site/privkey.pem'),
  cert: fs.readFileSync('./certs/turbo.torgod.site/fullchain.pem')
};

const server = https.createServer(certOptions, app);

server.listen(port, '0.0.0.0', async () => {
  console.log('\n\n', `${environment == 'dev' ? "🧪 DEVELOPMENT" : "🚨 PRODUCTION"}  ⛩️ PORT: ${port}`);
  await initImages()
  await api.xui.login()
  cron.schedule('0 0 */25 * *', () => {
    checkXUISessionExpiration()
  }).start();

  cron.schedule('*/1 * * * * *', () => {
    cleanExpiredCooldown()
    checkOrdersTimeout()
  }).start();

  // cron.schedule('* */1 * * * *', () => {
  //   checkConfigsExpiration()
  // }).start();

  cron.schedule('0 */24 * * *', () => {
    cleanExpiredConfigs()
    cleanExpiredOrders()
  }).start();

  cleanExpiredConfigs()
  cleanExpiredOrders()
});
