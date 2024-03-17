import axios from "axios";
import { exec } from 'child_process';
import dns from 'dns';
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
    name: "${SYMBOL}نامحدود 👤${LIMIT_IP} کاربره ⏰${PERIOD} روزه 💳${PRICE} تومان",
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
    id: 104,
    name: "${SYMBOL}نامحدود 👤${LIMIT_IP} کاربره ⏰${PERIOD} روزه 💳${PRICE} تومان",
    symbol: "🎖️",
    traffic: 0,
    period: 60,
    original_price: 400,
    final_price: 299,
    limit_ip: 1,
    version: 1,
    active: true,
  },
  {
    id: 98,
    name: "${SYMBOL}${TRAFFIC} گیگ 👤${LIMIT_IP} کاربره ⏰${PERIOD} روزه 💳${PRICE} تومان",
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
    id: 105,
    name: "${SYMBOL}${TRAFFIC} گیگ 👤${LIMIT_IP} کاربره ⏰${PERIOD} روزه 💳${PRICE} تومان",
    symbol: "🥉",
    traffic: 50,
    period: 60,
    original_price: 150,
    final_price: 119,
    limit_ip: 1,
    version: 1,
    active: true,
  },
  {
    id: 99,
    name: "${SYMBOL}${TRAFFIC} گیگ 👥${LIMIT_IP} کاربره ⏰${PERIOD} روزه 💳${PRICE} تومان",
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
    id: 106,
    name: "${SYMBOL}${TRAFFIC} گیگ 👥${LIMIT_IP} کاربره ⏰${PERIOD} روزه 💳${PRICE} تومان",
    symbol: "🥈",
    traffic: 100,
    period: 60,
    original_price: 250,
    final_price: 198,
    limit_ip: 2,
    version: 1,
    active: true,
  },
  {
    id: 100,
    name: "${SYMBOL}${TRAFFIC} گیگ 👥${LIMIT_IP} کاربره ⏰${PERIOD} روزه 💳${PRICE} تومان",
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
    name: "${SYMBOL}${TRAFFIC} گیگ 👥${LIMIT_IP} کاربره ⏰${PERIOD} روزه 💳${PRICE} تومان",
    symbol: "🥇",
    traffic: 100,
    period: 30,
    original_price: 230,
    final_price: 199,
    limit_ip: 4,
    version: 1,
    active: true,
  }
];

let PANEL_IP = '0.0.0.0'

const MAIN_INBOUND_ID = environment == 'dev' ? 3 : 2
const INBOUNDS = {
  dev: [{ id: 5, name: '#%F0%9F%9A%80%20Stable%20NOVA%202%20%28%D9%BE%DB%8C%D8%B4%D9%86%D9%87%D8%A7%D8%AF%DB%8C%29' }, { id: 3, name: '#%E2%9C%A8%20Stable%20NOVA%20' }],
  pro: [{ id: 4, name: '#%F0%9F%9A%80%20Stable%20NOVA%202%20%28%D9%BE%DB%8C%D8%B4%D9%86%D9%87%D8%A7%D8%AF%DB%8C%29' }, { id: 2, name: '#%E2%9C%A8%20Stable%20NOVA%20' }],
}

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
          ipn_callback_url: "http://vpn.torgod.top/update_payment",
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
            const token = setCookieHeader.split(';')[0].split('=')[1] + '='
            api.xui.session = { token, expires }
            console.log('\n ✅ Connected to X-UI panel \n\n');
            resolve();
          })
          .catch((error) => {
            reject(`API call error [xui/login]: ${error}`);
          });
      });
    },
    addClient: async (inbound, client) => {
      return new Promise(async (resolve, reject) => {
        const requestData = {
          id: inbound,
          settings: JSON.stringify({
            clients: [client]
          })
        };
        const options = {
          headers: {
            Cookie: `session=${api.xui.session.token}`
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
    deleteClient: async (inbound, uuid) => {
      return new Promise(async (resolve, reject) => {
        const options = {
          headers: {
            Cookie: `session=${api.xui.session.token}`
          }
        }
        await axios
          .post(process.env.XUI_API + `/${inbound}/delClient/${uuid}`, {}, options)
          .then((response) => {
            if (!response.data.success) {
              throw response.data.msg;
            }
            resolve();
          })
          .catch((error) => {
            reject(`API call error [xui/deleteClient]: ${error}`);
          });
      });
    },
    getClientInfo: async (email) => {
      return new Promise(async (resolve, reject) => {
        const options = {
          headers: {
            Cookie: `session=${api.xui.session.token}`
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
            Cookie: `session=${api.xui.session.token}`
          }
        }
        await axios
          .post(process.env.XUI_API + `/delDepletedClients/${MAIN_INBOUND_ID}`, null, options)
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
  addConfig: async (userId, orderId, plan, uuid) => {
    const config = vpn.createConfigObj(userId, orderId, plan.traffic, plan.period, plan.limit_ip, false, uuid)
    for (const inbound of INBOUNDS[`${environment}`]) {
      await api.xui.addClient(inbound.id, { ...config, email: config.email.replace('{INBOUND_ID}', inbound.id) })
    }
    return { ...config }
  },
  renewConfig: async (userId, orderId, plan) => {
    const subLink = vpn.getSubLink(orderId)
    const subConfigs = await vpn.getConfigFromSub(subLink)
    const matches = subConfigs[0]?.match(/:\/\/(.*?)@/);
    if (matches && matches.length > 1) {
      const uuid = matches[1];
      for (const inbound of INBOUNDS[`${environment}`]) {
        await api.xui.deleteClient(inbound.id, uuid)
      }
      await vpn.addConfig(userId, orderId, plan, uuid)
    } else {
      console.log('Can not find uuid in previous config for renew process!');
      throw 'Can not find uuid in previous config for renew process!'
    }
  },
  addTestConfig: async (userId) => {
    const testConfig = vpn.createConfigObj(userId, null, 2, 0.041, 1, true)
    for (const inbound of INBOUNDS[`${environment}`]) {
      await api.xui.addClient(inbound.id, { ...testConfig, email: testConfig.email.replace('{INBOUND_ID}', inbound.id) })
    }
    return { ...testConfig }
  },
  createConfigObj: (userId, orderId, traffic, period, limitIp, isTest = false, uuid) => {
    const expiryTime = moment().add(period * 24 * 60 * 60 * 1000).valueOf()
    return {
      id: uuid || uuidv4(),
      flow: 'xtls-rprx-vision',
      email: `${userId}-${isTest ? "test" : orderId}-{INBOUND_ID}`,
      limitIp: limitIp + 1,
      totalGB: traffic * 1024 * 1024 * 1024,
      expiryTime,
      enable: true,
      tgId: "",
      subId: isTest ? `${userId}-test` : `${orderId}`,
    }
  },
  getSubLink: (subId) => {
    return `${process.env.REALEY_SUB}/${subId}`
  },
  getConfigFromSub: async (subLink) => {
    try {
      let response = await axios.get(subLink)
      let content = Buffer.from(response.data, 'base64')
      content = content.toString('utf-8')
      const configs = content.split('\n')
      return configs
    } catch (err) {
      console.log(err);
    }
  }
}

let cooldowns = {};
const COOLDOWN_PERIOD = 1000;

const buttons = {
  mainMenu: [
    ["🛍️ خرید سرویس"],
    ["🔮 سرویس‌ های فعال", "🎁 تست نامحدود و رایگان",],
    ["🌟 اعتبار رایگان - معرفی دوستان 🌟"],
    ["☎️ پشتیبانی", "🔰 آموزش اتصال"],
  ],
  referralMenu: [
    ['📩 دعوت نامه اختصاصی من'],
    ['👥 دوستان من', '💳 اعتبار کیف پول'],
    ['بازگشت به منو اصلی ربات 🏡']
  ],
  education: [
    [{
      text: '🍀 اندروید Hiddify ✨',
      url: 'https://telegra.ph/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-%D8%A7%D9%86%D8%AF%D8%B1%D9%88%DB%8C%D8%AF-%D8%A8%D8%A7-HiddifyNG-08-03'
    }],
    [{
      text: '🍀 اندروید V2rayNG 🍭',
      url: 'https://telegra.ph/%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-%D8%A7%D9%86%D8%AF%D8%B1%D9%88%DB%8C%D8%AF-%D8%A8%D8%A7-V2rayNG-08-03'
    }],
    [{
      text: '🍎 آیفون V2Box 🗳️',
      url: 'https://telegra.ph/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-IOS-%D8%A8%D8%A7-%D9%86%D8%B1%D9%85-%D8%A7%D9%81%D8%B2%D8%A7%D8%B1-V2Box-08-03'
    }],
    [{
      text: '🖥️ ویندوز V2rayN 💫',
      url: 'https://t.me/nova_vpn_channel/24'
    }],
    [{
      text: '💻 مک بوک V2Box 🗳️',
      url: 'https://t.me/nova_vpn_channel/93'
    }]
  ],
  softwares: [
    [{
      text: '⬇️ اندروید - Hiddify (پیشنهاد ما) ⬇️',
      url: 'http://turbo.torgod.top/softwares/HiddifyNG.apk'
    }],
    [{
      text: '⬇️ اندروید - V2rayNG ⬇️',
      url: 'http://turbo.torgod.top/softwares/v2rayNG_1.8.5.apk'
    }],
    [{
      text: '⬇️ آی او اس (آیفون) - V2Box ⬇️',
      url: 'https://apps.apple.com/app/id6446814690'
    }],
    [{
      text: '⬇️ ویندوز - V2rayN ⬇️',
      url: 'https://mega.nz/file/52smHRKQ#-RiDYMV-uO1w4iq-E4catWywkcBIGP5-7QL2kl4htvk'
    }],
    [{
      text: '⬇️ مک او اس - V2Box ⬇️',
      url: 'https://apps.apple.com/fr/app/v2box-v2ray-client/id6446814690?l=en-GB'
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
    let userId, messageId, parentId
    for (const orderId in orders.waiting) {
      const order = orders.waiting[orderId];
      if (order.payment_limit_time < moment().valueOf()) {
        [userId, messageId] = [order.user_id, order.message_id]
        parentId = order?.parentId
        delete order.message_id
        orders.expired[order.id] = { ...order }
        delete orders.waiting[orderId]
        bot.deleteMessage(userId, messageId);
        bot.sendMessage(userId, `🫠 متاسفانه زمان انجام تراکنش برای ${parentId ? 'تمدید' : 'خرید'} سرویس ${parentId || orderId} به اتمام رسید.\n\n😇 لطفا مجددا اقدام به ${parentId ? 'تمدید' : 'خرید'} بفرمایید`, { parse_mode: "HTML" })
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

const cleanTrashOrders = async () => {
  try {
    const query = `SELECT email FROM client_traffics WHERE inbound_id=${MAIN_INBOUND_ID} AND email NOT LIKE '%-test-%'`; // get expired configs
    const rows = await api.db(query)
    const remoteOrdersId = rows.map(row => {
      const orderId = row.email.split('-')[1]
      return orderId
    });
    if (remoteOrdersId.length > 0) {
      let localOrdersId = Object.getOwnPropertyNames(db.data.orders.verified)
      localOrdersId.map(id => {
        if (!remoteOrdersId.includes(id)) {
          console.log('Order removed: ', id);
          delete db.data.orders.verified[id]
        }
      })
      db.write()
    }
  } catch (err) {
    console.log('cleanTrashOrders => ', err);
  }
}

const cleanExpiredConfigs = async () => {
  try {
    const date = Date.now()
    const query = `SELECT email, expiry_time FROM client_traffics WHERE inbound_id=${MAIN_INBOUND_ID} AND enable=0`; // get expired configs
    const rows = await api.db(query)
    const configs = [...rows];
    if (configs.length > 0) {
      for (const config of configs) {
        const { email, expiry_time } = config
        if (expiry_time + 172800000 <= date) {
          const [userId, orderId,] = email.split('-')
          const subId = vpn.getSubLink(orderId == 'test' ? `${userId}-test` : orderId)
          const subConfigs = await vpn.getConfigFromSub(subId)
          const matches = subConfigs[0].match(/:\/\/(.*?)@/);
          if (matches && matches.length > 1) {
            const uuid = matches[1];
            for (const inbound of INBOUNDS[`${environment}`]) {
              await api.xui.deleteClient(inbound.id, uuid)
            }
          }
        }
      }
    }
  } catch (err) {
    console.log('cleanExpiredConfigs => ', err);
  }
}

const checkConfigsExpiration = async () => {
  try {
    const date = Date.now()
    const query = `SELECT email, expiry_time FROM client_traffics WHERE inbound_id=${MAIN_INBOUND_ID} AND enable=1 AND email NOT LIKE '%-test-%' AND expiry_time < ${date + 172800000}`; // get items that is less than 48 hours
    const rows = await api.db(query)
    const configs = [...rows];
    if (configs.length > 0) {
      configs.map(async ({ email, expiry_time }) => {
        if (expiry_time != 0) {
          const [userId, orderId] = email.split('-')
          bot.sendMessage(userId, `⚠️ <b>هشدار انقضای سرویس: </b> کم تر از <b>${expiry_time < (date + 86400000) ? '24' : '48'} ساعت </b>به انقضای سرویس <b>${orderId}</b> باقی مانده است.\n\n♻️ لطفا جهت جلوگیری از قطع اتصال، اقدام به تمدید سرویس نمایید 👇`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: '♻️ تمدید سرویس', callback_data: JSON.stringify({ act: 'renew_gen', data: { orderId } }) }]]
              }
            })
        }
      })
    }
  } catch (err) {
    console.log('checkConfigsExpiration => ', err);
  }
}

const checkConfigsTraffics = async () => {
  try {
    const query = `SELECT email, total_usage, total FROM client_traffics WHERE inbound_id=${MAIN_INBOUND_ID} AND enable=1 AND email NOT LIKE '%-test-%' AND sent_traffic_notif=false AND total <> 0;`; // get items that is less than 48 hours
    const rows = await api.db(query)
    const configs = [...rows];
    if (configs.length > 0) {
      for (const { email, total_usage, total } of configs) {
        const [userId, orderId] = email.split('-')
        const remainingTraffic = ((total - total_usage) / 1024 / 1024 / 1024).toFixed(2)
        if (remainingTraffic <= 1.00) {
          try {
            await api.db(`UPDATE client_traffics SET sent_traffic_notif=true WHERE email LIKE '${userId}-${orderId}-%';`)
          } catch (err) {
            console.log('Error for sent_traffic_notif=true: ', err);
          }
          bot.sendMessage(userId, `⚠️ <b>هشدار حجم: </b> کم تر از <b>1 گیگابایت</b> از حجم سرویس <b>${orderId}</b> باقی مانده است.\n\n♻️ لطفا جهت جلوگیری از قطع اتصال، اقدام به تمدید سرویس نمایید 👇`,
            {
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [[{ text: '♻️ تمدید سرویس', callback_data: JSON.stringify({ act: 'renew_gen', data: { orderId } }) }]]
              }
            })
        }
      }
    }
  } catch (err) {
    console.log('checkConfigsTraffics => ', err);
  }
}

const updateConfigsTotalUsages = async () => {
  try {
    const idValues = INBOUNDS[`${environment}`].map(item => item.id);
    const inClause = idValues.length > 0 ? `IN (${idValues.join(', ')})` : '';
    const query = `SELECT SUBSTR(email, 1, INSTR(email, '-') - 1) AS user_id, SUBSTR(email, INSTR(email, '-') + 1, INSTR(SUBSTR(email, INSTR(email, '-') + 1), '-') - 1) AS order_id, SUM(up) AS summed_up, SUM(down) AS summed_down, total FROM client_traffics WHERE traffic_expired=false AND inbound_id ${inClause} AND email LIKE '%-%-%' GROUP BY user_id, order_id;`
    const rows = await api.db(query)
    const configs = [...rows];
    for (const config of configs) {
      try {
        const updateTotalUsageQuery = `UPDATE client_traffics SET total_usage=${config.summed_up + config.summed_down} where email LIKE '${config.user_id}-${config.order_id}-%';`
        await api.db(updateTotalUsageQuery)
        if (config.total != 0 && (config.summed_up + config.summed_down) >= config.total) {
          const disableExpiredTrafficQuery = `UPDATE client_traffics SET traffic_expired=true, up=${config.summed_up}, down=${config.summed_down} where email LIKE '${config.user_id}-${config.order_id}-%';`
          await api.db(disableExpiredTrafficQuery)
        }
      } catch (err) {
        console.log(`Error update total_usage for ${config.user_id}-${config.order_id}: `, err);
      }
    }
  } catch (err) {
    console.log('updateConfigsTotalUsages => ', err);
  }
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
  try {
    const channelSubscription = await bot.getChatMember('@nova_vpn_channel', userId)
    if (channelSubscription.status !== 'member' && channelSubscription.status !== 'creator' && channelSubscription.status !== 'administrator') {
      bot.sendMessage(userId, `⚠️ <b>جهت استفاده سودمند از ربات و آگاهی از بروزرسانی های شبکه ای سرویس، توصیه میشود که حتما در کانال ما عضو شوید ⚠️</b>\n\n👇👇👇👇👇👇👇👇👇👇👇👇👇`,
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: "📣 کانال اطلاع رسانی", url: "https://t.me/nova_vpn_channel" }]
            ]
          }, parse_mode: 'HTML'
        }
      );
      // return false
    }
  } catch (err) {
    console.error('Error:', err);
    // return false
  }
  return true
}

const getReferralWalletBalance = (userId) => {
  let totalBalance = 0
  totalBalance = db.data.referral_wallet[userId].balance
  return totalBalance
}

const cleanLogs = async () => {
  const filesPath = ['/usr/local/x-ui/error.log', '/var/log/3xipl-access-persistent.log'];

  filesPath.map((path) => {
    fs.truncate(path, 0, (err) => {
      if (err) {
        console.error(`Error truncating file: ${err}`);
        return;
      }
      console.log('clear log successfully');
    });
  })
}

const getBackup = () => {
  exec('sh bash_scripts/bot-db-backup.sh', (error) => {
    error && console.error('Error [sh bash_scripts/bot-db-backup.sh]:', error);
  })
  setTimeout(() => {
    exec('sh bash_scripts/xui-db-backup.sh', (error) => {
      error && console.error('Error [sh bash_scripts/xui-db-backup.sh]:', error);
    })
  }, 20000);
}

bot.onText(/\/start(?: (.*))?/, async ({ from }, match) => {
  if (from.is_bot)
    return;

  const baseCheckingStatus = await baseChecking(from.id, true)
  if (!baseCheckingStatus) return

  const { users, referral_wallet } = db.data

  const user = users[from.id];
  if (!user) {
    const referral = match[1]

    users[from.id] = {
      id: from.id,
      tg_name: from.first_name,
      tg_username: from.username,
      tested: false,
      referral: referral && users[referral] ? referral : null,
      created_at: moment().format().slice(0, 19)
    }
    referral_wallet[from.id] = {
      balance: 0,
      records: []
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
          const parentId = order?.parentId
          delete order.message_id
          order?.trashMessages?.map((msgId) => {
            bot.deleteMessage(userId, msgId);
          })
          delete order?.trashMessages
          if (parentId) {
            await vpn.renewConfig(userId, parentId, order.plan)

            orders.verified[parentId] = { ...order, id: parentId, paid_at: moment().format().slice(0, 19), renewed: true }
            delete orders.verified[parentId].parentId
            delete orders.waiting[orderId]
            bot.deleteMessage(userId, messageId);

            if (order?.referral_balance_used) {
              db.data.referral_wallet[userId].balance -= order.referral_balance_used
              db.data.referral_wallet[userId].records.push(
                {
                  type: "withdraw",
                  orderId,
                  amount: order.referral_balance_used
                }
              )
            }

            const user = db.data.users[userId]
            if (user.referral) {
              let profit = parseInt((order.plan.final_price * 10000 * 0.1).toFixed())
              db.data.referral_wallet[user.referral].balance += profit
              db.data.referral_wallet[user.referral].records.push({
                type: "deposit",
                subsetId: `${userId}`,
                subsetOrder: `${orderId}`,
                amount: profit
              })
            }

            db.write()

            bot.sendMessage(userId, `✅ سرویس <b>${parentId}</b> تا تاریخ <b>${order.expire_at.slice(0, 10)}</b> با موفقیت تمدید شد\n\n🔋 <b>حجم: </b>${order.plan.traffic > 0 ? `${order.plan.traffic} گیگ` : 'نامحدود'}\n⏰ <b>مدت: </b>${order.plan.period} روزه\n${order.plan.limit_ip > 1 ? "👥" : "👤"}<b>نوع طرح: </b>${order.plan.limit_ip} کاربره\n💳 <b>هزینه پرداخت شده: </b>${(order.amount).toLocaleString()} ریال`,
              { parse_mode: 'HTML' })
          } else {
            const config = await vpn.addConfig(userId, orderId, order.plan)
            const subLink = vpn.getSubLink(config.subId)
            const subLinkQR = await qrGenerator(subLink)

            orders.verified[order.id] = { ...order, paid_at: moment().format().slice(0, 19) }
            delete orders.waiting[orderId]
            bot.deleteMessage(userId, messageId);

            if (order?.referral_balance_used) {
              db.data.referral_wallet[userId].balance -= order.referral_balance_used
              db.data.referral_wallet[userId].records.push(
                {
                  type: "withdraw",
                  orderId,
                  amount: order.referral_balance_used
                }
              )
            }

            const user = db.data.users[userId]
            if (user.referral) {
              let profit = parseInt((order.plan.final_price * 10000 * 0.1).toFixed())
              db.data.referral_wallet[user.referral].balance += profit
              db.data.referral_wallet[user.referral].records.push({
                type: "deposit",
                subsetId: `${userId}`,
                subsetOrder: `${orderId}`,
                amount: profit
              })
            }

            db.write()

            bot.sendPhoto(userId, subLinkQR, {
              caption: `✅ تراکنش شما با موفقیت تایید شد.\n\n🛍️ <b>شماره سرویس: </b>${order.id}\n🔋 <b>حجم: </b>${order.plan.traffic > 0 ? `${order.plan.traffic} گیگ` : 'نامحدود'}\n⏰ <b>مدت: </b>${order.plan.period} روزه\n${order.plan.limit_ip > 1 ? "👥" : "👤"}<b>نوع طرح: </b>${order.plan.limit_ip} کاربره\n💳 <b>هزینه پرداخت شده: </b>${(order.amount).toLocaleString()} ریال\n\n‼️ <u> لینک پایین را کپی کرده و بر اساس آموزش های زیر، از آن برای دریافت کانفیگ ها در نرم افزارها استفاده کنید </u>\n\n👇 👇 👇 👇 👇 👇 👇`,
              parse_mode: "HTML",
            });
            setTimeout(() => {
              bot.sendMessage(userId, `<code>${subLink}</code>`, { parse_mode: 'HTML' })
            }, 500)
            setTimeout(() => {
              bot.sendMessage(userId, '👆 👆 👆 👆 👆 👆 👆\n\nآخرین نسخه نرم افزار ها به همراه آموزش نحوه اتصال بر اساس سیستم عامل شما در پایین قرار داده شده 👇',
                {
                  parse_mode: 'HTML',
                  reply_markup: JSON.stringify({
                    inline_keyboard: buttons.education,
                    resize_keyboard: true,
                  }),
                })
            }, 2000)
          }
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
          case "all": {
            let recipients = Object.getOwnPropertyNames(users).filter((id) => id != ownerId)

            let splitedArray = []
            let chunkSize = 30
            for (let i = 0; i < recipients.length; i += chunkSize) {
              splitedArray.push(recipients.slice(i, i + chunkSize))
            }

            let numberOfSuccess = 0
            bot.sendMessage(from.id, '⬆️ Start to sending...')

            for (const division of splitedArray) {
              try {
                numberOfSuccess += division.length
                let botMsgToAdmin = `✅ <b>The message was sent</b> ✅\n\n📫 <b>Recipients:</b>\n\n`
                for (const userId of division) {
                  const userInfo = users[userId]
                  bot.sendMessage(userInfo.id, message)
                  botMsgToAdmin += `\nid: ${userInfo.id}\nusername: @${userInfo.tg_username || 'none'}\nname: ${userInfo.tg_name}\n-----------------------------`
                }
                botMsgToAdmin += `\n\n\n👥 <b>Total Recipients: </b>${numberOfSuccess}/${recipients.length}\n\n`
                botMsgToAdmin += `✉️ <b>Message:</b>\n\n${message}`
                bot.sendMessage(from.id, botMsgToAdmin, { parse_mode: 'HTML' })
              } catch (error) {
                console.log(error)
                bot.sendMessage(from.id, `❌ Failed to send message to division users: ${error}`, { parse_mode: 'HTML' })
              }
              if (numberOfSuccess != recipients.length)
                await new Promise((resolve) => setTimeout(resolve, 900000))
            }

            setTimeout(() => bot.sendMessage(from.id, "========================\n\n✅ The message was successfully sent to all recipients ✅\n\n========================", { parse_mode: "HTML" }), 1000)
            break;
          }
          case "sub": {
            const query = `SELECT email FROM client_traffics WHERE inbound_id=${MAIN_INBOUND_ID} AND email NOT LIKE '%-test-%'`;
            let rows = await api.db(query)
            if (rows.length == 0) {
              bot.sendMessage(from.id, '⚠️ There is no any sub user! ⚠️')
              return
            }
            let recipients = []
            rows.map(({ email }) => {
              const userId = email.split('-')[0]
              if (!recipients.find((item) => item == userId) && userId !== ownerId) {
                recipients.push(userId)
              }
            })

            let splitedArray = []
            let chunkSize = 35
            for (let i = 0; i < recipients.length; i += chunkSize) {
              splitedArray.push(recipients.slice(i, i + chunkSize))
            }

            let numberOfSuccess = 0
            bot.sendMessage(from.id, '⬆️ Start to sending...')

            for (const division of splitedArray) {
              try {
                numberOfSuccess += division.length
                let botMsgToAdmin = `✅ <b>The message was sent</b> ✅\n\n📫 <b>Recipients:</b>\n\n`
                for (const userId of division) {
                  const userInfo = users[userId]
                  bot.sendMessage(userInfo.id, message)
                  botMsgToAdmin += `\nid: ${userInfo.id}\nusername: @${userInfo.tg_username || 'none'}\nname: ${userInfo.tg_name}\n-----------------------------`
                }
                botMsgToAdmin += `\n\n\n👥 <b>Total Recipients: </b>${numberOfSuccess}/${recipients.length}\n\n`
                botMsgToAdmin += `✉️ <b>Message:</b>\n\n${message}`
                bot.sendMessage(from.id, botMsgToAdmin, { parse_mode: 'HTML' })
              } catch (error) {
                console.log(error)
                bot.sendMessage(from.id, `❌ Failed to send message to division users: ${error}`, { parse_mode: 'HTML' })
              }
              if (numberOfSuccess != recipients.length)
                await new Promise((resolve) => setTimeout(resolve, 900000))
            }

            setTimeout(() => bot.sendMessage(from.id, "========================\n\n✅ The message was successfully sent to all recipients ✅\n\n========================", { parse_mode: "HTML" }), 1000)
            break;
          }
          case 'unsub': {
            const query = `SELECT email FROM client_traffics WHERE inbound_id=${MAIN_INBOUND_ID} AND email NOT LIKE '%-test-%'`;
            let rows = await api.db(query)
            const allUsers = Object.getOwnPropertyNames(users)
            const subUsers = []
            let recipients = []
            rows.map(({ email }) => {
              const userId = email.split('-')[0]
              if (!subUsers.find((item) => item == userId)) {
                subUsers.push(userId)
              }
            })

            recipients = allUsers.filter(element => !subUsers.includes(element))
            recipients = recipients.filter((userId) => userId !== ownerId)

            let splitedArray = []
            let chunkSize = 35
            for (let i = 0; i < recipients.length; i += chunkSize) {
              splitedArray.push(recipients.slice(i, i + chunkSize))
            }

            let numberOfSuccess = 0
            bot.sendMessage(from.id, '⬆️ Start to sending...')

            for (const division of splitedArray) {
              try {
                numberOfSuccess += division.length
                let botMsgToAdmin = `✅ <b>The message was sent</b> ✅\n\n📫 <b>Recipients:</b>\n\n`
                for (const userId of division) {
                  const userInfo = users[userId]
                  bot.sendMessage(userInfo.id, message)
                  botMsgToAdmin += `\nid: ${userInfo.id}\nusername: @${userInfo.tg_username || 'none'}\nname: ${userInfo.tg_name}\n-----------------------------`
                }
                botMsgToAdmin += `\n\n\n👥 <b>Total Recipients: </b>${numberOfSuccess}/${recipients.length}\n\n`
                botMsgToAdmin += `✉️ <b>Message:</b>\n\n${message}`
                bot.sendMessage(from.id, botMsgToAdmin, { parse_mode: 'HTML' })
              } catch (error) {
                console.log(error)
                bot.sendMessage(from.id, `❌ Failed to send message to division users: ${error}`, { parse_mode: 'HTML' })
              }
              if (numberOfSuccess != recipients.length)
                await new Promise((resolve) => setTimeout(resolve, 900000))
            }

            setTimeout(() => bot.sendMessage(from.id, "========================\n\n✅ The message was successfully sent to all recipients ✅\n\n========================", { parse_mode: "HTML" }), 1000)
            break;
          }
          default: {
            const recipients = recipient.split(',')
            let notValid = false
            recipients.map((targetId) => {
              if (!notValid && !users[targetId]) {
                notValid = true
              }
            })
            if (notValid) {
              bot.sendMessage(from.id, '⚠️ Target user not found! ⚠️')
              return
            }

            let splitedArray = []
            let chunkSize = 30
            for (let i = 0; i < recipients.length; i += chunkSize) {
              splitedArray.push(recipients.slice(i, i + chunkSize))
            }

            let numberOfSuccess = 0
            bot.sendMessage(from.id, '⬆️ Start to sending...')

            for (const division of splitedArray) {
              try {
                numberOfSuccess += division.length
                let botMsgToAdmin = `✅ <b>The message was sent</b> ✅\n\n📫 <b>Recipients:</b>\n\n`
                for (const userId of division) {
                  const userInfo = users[userId]
                  bot.sendMessage(userInfo.id, message)
                  botMsgToAdmin += `\nid: ${userInfo.id}\nusername: @${userInfo.tg_username || 'none'}\nname: ${userInfo.tg_name}\n-----------------------------`
                }
                botMsgToAdmin += `\n\n\n👥 <b>Total Recipients: </b>${numberOfSuccess}/${recipients.length}\n\n`
                botMsgToAdmin += `✉️ <b>Message:</b>\n\n${message}`
                bot.sendMessage(from.id, botMsgToAdmin, { parse_mode: 'HTML' })
              } catch (error) {
                console.log(error)
                bot.sendMessage(from.id, `❌ Failed to send message to division users: ${error}`, { parse_mode: 'HTML' })
              }
              if (numberOfSuccess != recipients.length)
                await new Promise((resolve) => setTimeout(resolve, 900000))
            }

            setTimeout(() => bot.sendMessage(from.id, "========================\n\n✅ The message was successfully sent to all recipients ✅\n\n========================", { parse_mode: "HTML" }), 1000)
            break;
          }
        }
      }
    } catch (err) {
      console.error("❌ Error: Sending message> ", err);
      bot.sendMessage(from.id, '❌ Failed to send message ❌')
    }
  }
});

// bot.onText(/add_time/, async ({ from, text }) => {
//   const baseCheckingStatus = await baseChecking(from.id, true)
//   if (!baseCheckingStatus) return

//   if (from.id == ownerId) {
//     const regexAdditionalTime = /add_time\s+(\d+)/;
//     const matchAdditionalTime = text.match(regexAdditionalTime);
//     const additionalTime = matchAdditionalTime ? matchAdditionalTime[1].trim() : null;

//     if (additionalTime != null) {
//       let inbounds = INBOUNDS[environment].map((item) => {
//         return item.id
//       })

//       try {
//         let query = `UPDATE client_traffics SET expiry_time = expiry_time + ${additionalTime * 3600000} WHERE inbound_id IN (${inbounds[0]}, ${inbounds[1]});`
//         console.log(query);
//         await api.db(query)
//         bot.sendMessage(from.id, '✅ Done ✅')
//       } catch (err) {
//         console.log('add_time error: ', err);
//         bot.sendMessage(from.id, `❌ Failed with error:\n${err}`)
//       }
//     }
//   }
// })

bot.onText(/🎁 تست نامحدود و رایگان/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  try {
    bot.sendMessage(from.id, `⚠️ <u><b>بسیار مهم: اگر نرم افزار شما بروز نباشد نمیتوانید به سرویس ما متصل شوید</b></u> ⚠️\n\n1️⃣  <b>حتما حتما حتی اگر</b> نرم افزار مورد نظر را از قبل نصب شده دارید، دوباره بر اساس سیستم عامل خود، <b>آخرین نسخه</b> آن را از لیست زیر <b>دانلود و نصب</b> کنید\n\n2️⃣ پس از نصب و بروزرسانی، روی دکمه "✅ <b>بروزرسانی کردم</b> ✅" که در زیر لیست پایین میباشد بزنید`, { parse_mode: "HTML" }
    ).then((message) => {
      setTimeout(() => {
        bot.editMessageReplyMarkup(
          JSON.stringify({
            inline_keyboard: [...buttons.softwares.slice(0, 3), [{ text: '✅ بروزرسانی کردم ✅', callback_data: JSON.stringify({ act: 'gen_test' }) }]],
            resize_keyboard: true,
          }),
          { chat_id: from.id, message_id: message.message_id })
      }, 10000)
    })
  } catch (e) {
    console.error("❌ Error: edit replyMarkup of test config> ", e);
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

  const botMsg =
    `✅ <b>مزایای تمامی سرویس ها</b>\n\n💥 دور زدن اینترنت ملی\n💥 مناسب تمامی اپراتور ها\n💥 پشتیبانی از تمامی سیستم عامل ها\n💥مخصوص دانلود با سرعت بالا\n💥 رنج آی پی ثابت\n\n👇 لطفا یکی گزینه ها را انتخاب کنید 👇`;
  bot.sendMessage(from.id, botMsg, {
    reply_markup: {
      inline_keyboard: [
        [{
          text: "🛍️ خرید سرویس جدید", callback_data: JSON.stringify({
            act: "store",
          })
        }],
        [{
          text: "♻️ تمدید سرویس قبلی", callback_data: JSON.stringify({
            act: "renew_show_orders",
          })
        }]
      ]
    },
    parse_mode: "HTML"
  });
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
    const query = `SELECT email, total_usage, total, enable FROM client_traffics WHERE inbound_id=${MAIN_INBOUND_ID} AND email LIKE '${user.id}-%' AND email NOT LIKE '%-test-%'`;
    const rows = await api.db(query)
    const configs = [...rows];
    if (configs.length == 0) {
      bot.sendMessage(from.id, "🫠 در حال حاضر هیچ سرویس فعالی ندارید\n\n🛍️ جهت خرید از منو پایین اقدام بفرمایید 👇");
      return
    }
    configs.map(async ({ email, total_usage, total, enable }) => {
      const orderId = email.split('-')[1]
      try {
        const { plan, paid_at, expire_at } = db.data.orders.verified[orderId]
        let remainingTraffic = ((total - total_usage) / 1024 / 1024 / 1024).toFixed(2)
        remainingTraffic = remainingTraffic > 0 ? remainingTraffic : 0
        const subLink = vpn.getSubLink(orderId)
        const subLinkQR = await qrGenerator(subLink)
        bot.sendPhoto(from.id, subLinkQR,
          {
            caption: `🛍️ <b>شماره سرویس: </b>${orderId}\n🪫 <b>حجم باقیمانده: </b>${total > 0 ? `${remainingTraffic} گیگ` : 'نامحدود'}\n⏱️ <b>تاریخ تحویل: </b>${paid_at.slice(0, 10)}\n📅 <b>تاریخ انقضا: </b>${expire_at.slice(0, 10)}\n${plan.limit_ip > 1 ? "👥" : "👤"} <b>نوع طرح: </b>${plan.limit_ip} کاربره\n\n👀 <b>وضعیت سرویس: ${enable ? '✅ فعال' : '❌ غیر فعال'}</b>${enable ? `\n\n♻️ <b>لینک آپدیت خودکار: </b>(روی لینک پایین بزنید تا کپی شود 👇)\n<code>${subLink}</code>` : '\n\n⚠️ حجم و یا تاریخ انقضای این سرویس به پایان رسیده. جهت تمدید سرویس روی دکمه زیر بزنید 👇'}`,
            parse_mode: "HTML",
            reply_markup: {
              inline_keyboard: [
                [{ text: '♻️ تمدید سرویس ♻️', callback_data: JSON.stringify({ act: 'renew_gen', data: { orderId } }) }],
                [{ text: '✍️ تغییر و تمدید سرویس ✍️', callback_data: JSON.stringify({ act: 'edit_plan', data: { orderId } }) }],
              ]
            }
          }
        );
      } catch (err) {
        console.log(err);
      }
    })
  } catch (err) {
    console.log(err);
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی در دریافت سرویس های شما پیش اومده\n\n😇 لطفا بعد از چند دقیقه دوباره تلاش کنید.");
  }
});

bot.onText(/🔰 آموزش اتصال/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const botMsg = '⚠️ <u><b>حتما از آخرین نسخه هر نرم افزار که در مقالات پایین قرار دارد استفاده کنید</b></u> ⚠️\n\n<b>🍀 اندروید: </b> Hiddify, v2rayNG\n<b>🍎 آی او اس (آیفون): </b>V2BOX\n<b>🖥️ ویندوز: </b>V2rayN\n<b>💻 مک: </b>V2Box\n\nبر اساس سیستم عامل خود یکی از نرم افزارهای زیر را انتخاب کنید👇'
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

bot.onText(/🌟 اعتبار رایگان - معرفی دوستان 🌟/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی پیش اومده\n\n😇 لطفا بر روی /start بزنید.");
    return
  }
  const botMsg = `<b>🌟 دریافت اعتبار رایگان:</b>\n\n1️⃣ از منو اصلی روی دکمه <b>“📩 دعوت نامه اختصاصی من”</b> بزنید\n\n2️⃣ دعوت نامه خود را برای دوستان و آشنایان فوروارد کنید تا در سود حاصل از خرید و تمدید ماهیانه سرویس آنها شریک شوید\n\n✅ میتوانید از این اعتبار جهت خرید و تمدید سرویس خود استفاده کنید 😇`
  bot.sendMessage(from.id, botMsg,
    {
      reply_markup: {
        keyboard: buttons.referralMenu,
        resize_keyboard: true,
      }, parse_mode: "HTML"
    }
  );
});

bot.onText(/بازگشت به منو اصلی ربات 🏡/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی پیش اومده\n\n😇 لطفا بر روی /start بزنید.");
    return
  }
  const botMsg = `به منو اصلی بازگشتید 🏡`
  bot.sendMessage(from.id, botMsg,
    {
      reply_markup: {
        keyboard: buttons.mainMenu,
        resize_keyboard: true,
      }, parse_mode: "HTML"
    }
  );
});

bot.onText(/💳 اعتبار کیف پول/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی پیش اومده\n\n😇 لطفا بر روی /start بزنید.");
    return
  }
  try {
    const referralBalance = getReferralWalletBalance(from.id)
    bot.sendMessage(from.id, `---------------------------\n💳 اعتبار کیف پول:\n\n💰 مبلغ: ${Number(String(referralBalance).slice(0, -1)).toLocaleString()} تومان\n---------------------------`,
      { parse_mode: "HTML" }
    );
  } catch (error) {
    console.log('Error for getting wallet balance: ', error);
    bot.sendMessage(from.id, "🤕 اواو!\n🤔 فکر کنم یه مشکلی پیش اومده\n\n😇 لطفا بعد از چند دقیقا مجددا تلاش کنید");
  }
});

bot.onText(/👥 دوستان من/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی پیش اومده\n\n😇 لطفا بر روی /start بزنید.");
    return
  }
  try {
    const { users } = db.data
    const referrals = []

    for (const user of Object.keys(users)) {
      if (users[user].referral == from.id.toString()) {
        referrals.push(users[user])
      }
    }

    let botMsg = '👥 دوستان من:\n'

    if (referrals.length > 0) {
      referrals.map((referral, index) => {
        botMsg += `\n🥰 دوست شماره (${index + 1}):`
        botMsg += `\nنام مستعار: ${referral?.tg_name}`
        if (referral?.tg_username) botMsg += `\nنام کاربری: @${referral.tg_username}`
        botMsg += '\n---------------------------'
      })
    } else {
      botMsg += '\nمتاسفانه هنوز شخصی از طرف شما به ربات دعوت نشده است 😔'
    }


    bot.sendMessage(from.id, botMsg, { parse_mode: "HTML" });
  } catch (error) {
    console.log('Error for getting friends list: ', error);
    bot.sendMessage(from.id, "🤕 اواو!\n🤔 فکر کنم یه مشکلی پیش اومده\n\n😇 لطفا بعد از چند دقیقا مجددا تلاش کنید");
  }
});

bot.onText(/📩 دعوت نامه اختصاصی من/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی پیش اومده\n\n😇 لطفا بر روی /start بزنید.");
    return
  }
  const botMsg = `📩 لینک دعوت شما:\n\nhttps://t.me/nova_vpn_bot?start=${from.id}`
  bot.sendMessage(from.id, botMsg,
    {
      reply_markup: {}, parse_mode: "HTML"
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

  switch (queryData.act) {
    case "check_channel_subscription": {
      baseChecking(chatId)
      break
    }
    case 'gen_test': {
      try {
        if (user.tested) {
          bot.sendMessage(
            from.id,
            "🙃 شما قبلا کانفیگ تست را دریافت نموده‌اید.\n\n😇 لطفا درصورت رضایت از کیفیت سرویس، از منو پایین اقدام به خرید سرویس بفرمایید 👇"
          );
          return;
        }
        const { subId } = await vpn.addTestConfig(user.id)
        const subLink = vpn.getSubLink(subId)
        user.tested = true
        db.write()

        bot.sendMessage(from.id, `🎁 <b>حجم</b>: نامحدود\n⏰ <b>مدت استفاده</b>: ۱ ساعت\n\n‼️ <u> لینک پایین را کپی کرده و بر اساس آموزش های زیر، از آن برای دریافت کانفیگ ها در نرم افزارها استفاده کنید </u>\n\n👇 👇 👇 👇 👇 👇 👇`, {
          parse_mode: "HTML",
        });
        setTimeout(() => {
          bot.sendMessage(from.id, `<code>${subLink}</code>`, { parse_mode: 'HTML' })
        }, 500)
        setTimeout(() => {
          bot.sendMessage(from.id, '👆 👆 👆 👆 👆 👆 👆\n\nآخرین نسخه نرم افزار ها به همراه آموزش نحوه اتصال بر اساس سیستم عامل شما در پایین قرار داده شده 👇',
            {
              parse_mode: 'HTML',
              reply_markup: JSON.stringify({
                inline_keyboard: buttons.education,
                resize_keyboard: true,
              }),
            })
        }, 2000)
        if (user.id != ownerId) {
          setTimeout(() => {
            bot.sendMessage(from.id,
              `⚠️ به اطلاع میرساند، تنها <b>۵ دقیقه</b> تا اتمام مهلت تست و قطع اتصال شما باقی مانده است\n\nدرصورت رضایت از سرویس، با زدن دکمه "<b>🛍️ خرید سرویس</b>" از منو اصلی، اقدام به خرید سرویس بفرمایید.`,
              { parse_mode: 'HTML' }
            )
          }, 3240000)
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
      break
    }
    case "store": {
      const botMsg =
        `<b>🎉 سرویس های 60 روزه اضافه شد 🎉</b>\n\n🔻 سرویس مورد نظر خود را انتخاب کنید🔻`;
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
                    .replace("${PERIOD}", item.period)
                    .replace("${PRICE}", item.final_price),
                  callback_data: JSON.stringify({
                    act: "plan_detailes",
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
      break
    }
    case "plan_detailes": {
      const plan = plans.find((item) => item.id == queryData.data.planId);
      const referralBalance = getReferralWalletBalance(chatId)

      const botMsg = `${plan.limit_ip > 1 ? "👥" : "👤"} <b>نوع طرح: </b>${plan.limit_ip} کاربره\n\n${plan.symbol} <b>حجم:</b> ${plan.traffic > 0 ? `${plan.traffic} گیگ` : 'نامحدود'}\n\n⏰ <b>مدت:</b> ${plan.period} روزه\n\n🎁 <b>قیمت:</b> <s>${plan.original_price} تومان</s>  ⬅️ <b>${plan.final_price} تومان</b> 🎉\n\n${`🌟 <b>تخفیف معرفی دوستان: </b>${Number(String(referralBalance).slice(0, -1)).toLocaleString()} تومان\n\n`}😊 برای خرید نهایی روی دکمه "✅ صدور فاکتور" کلیک کنید.`

      bot.editMessageText(botMsg, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: "⬅️ بازگشت",
                callback_data: JSON.stringify({ act: "store" }),
              },
              {
                text: "✅ صدور فاکتور",
                callback_data: JSON.stringify({
                  act: "gen_order",
                  data: { planId: plan.id },
                }),
              },
            ],
          ],
        },
      });
      break
    }
    case "gen_order": {
      const plan = plans.find((item) => item.id == queryData.data.planId);
      const parentId = queryData.data?.parentId
      try {
        const orderId = Math.floor(Math.random() * (999999999 - 100000000 + 1)) + 100000000;
        const amount = (plan.final_price * 10000) - Math.floor(Math.random() * 1000)
        const referralBalance = getReferralWalletBalance(chatId)
        let [difference, newReferralBalance, shouldPay] = [0, 0, 0]

        difference = amount - referralBalance
        if (difference >= 0) {
          newReferralBalance = 0
          shouldPay = difference
        } else {
          const MIN_TRANSACTION_AMOUNT = 40000 - Math.floor(Math.random() * 1000)
          newReferralBalance = Math.abs(difference) - MIN_TRANSACTION_AMOUNT
          shouldPay = MIN_TRANSACTION_AMOUNT
        }

        const paymentLimitTime = moment().add(32400000) // 9 hour

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
          amount: shouldPay,
          created_at: moment().format().slice(0, 19),
          expire_at: moment().add(plan.period * 24 * 60 * 60 * 1000).format().slice(0, 19),
          payment_limit_time: paymentLimitTime.valueOf()
        };

        if (referralBalance) {
          order.referral_balance_used = referralBalance - newReferralBalance
        }

        if (parentId)
          order.parentId = parseInt(parentId)
        db.data.orders.waiting[orderId] = order;
        db.write();

        bot.editMessageText(
          `🛍️ <b>شماره سرویس: </b>${parentId || orderId}\n\n💳 <b>مبلغ نهایی: </b>\n<code>${shouldPay.toLocaleString()}</code> ریال 👉 (روی اعداد ضربه بزنید تا کپی شود)\n\n🏦 <b>شماره کارت: </b>\n<code>${environment === 'pro' ? BANK_ACCOUNT.CARD_NUMBER : '0000-0000-0000-0000'}</code> 👉 (ضربه بزنید تا کپی شود)\n\n👤 <b>صاحب حساب: </b> ${environment === 'pro' ? BANK_ACCOUNT.OWNER_NAME : 'admin'}\n\n⚠️ <b>مهلت پرداخت: </b> تا ساعت <u><b>${paymentLimitTime.format().slice(11, 16)}</b></u> ⚠️\n\n‼️ <u><b>توجه: از رند کردن مبلغ نهایی خودداری کنید </b></u>‼️\n\n✅ جهت تکمیل خرید سرویس، مبلغ <u><b>دقیق</b></u> بالا را به شماره کارت ذکر شده واریز بفرمایید و رسید خود را برای <u><b>پشتیبانی</b></u> ارسال کنید 👇`,
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
                      act: "gen_order",
                      data: { planId: plan.id },
                    }),
                  },
                ],
                [
                  {
                    text: "⬅️ بازگشت",
                    callback_data: JSON.stringify({ act: "store" }),
                  },
                ],
              ],
            },
          }
        );
      }
      break
    }
    case 'education': {
      switch (queryData.data.device) {
        case 'android':
          bot.sendPhoto(chatId, images.hiddify, {
            caption: '‼️ <b>آخرین نسخه هیدیفای را نصب کنید</b>\n\n👈 <b><a href="http://turbo.torgod.top/softwares/HiddifyNG.apk">(دریافت آخرین نسخه هیدیفای)</a> 👉</b>\n\n🔰 طبق آموزش داخل عکس عمل کنید',
            parse_mode: "HTML"
          })
          break;

        default:
          break;
      }
      break
    }
    case 'renew_gen': {
      const { orderId } = queryData.data
      const order = db.data.orders.verified[orderId]
      if (!order) {
        bot.sendMessage(chatId, '⚠️ این سرویس دیگر در دسترس نمی باشد\n\nلطفا از منو اصلی اقدام به خرید سرویس جدید نمایید 👇');
        return
      }
      const plan = plans.find((item) => item.id == order.plan.id && item.active);
      if (!plan) {
        bot.sendMessage(chatId, `😔 متاسفانه درحال حاضر امکان تمدید این سرویس وجود ندارد.\n\n🙏 لطفا از طریق دکمه <b>"🛍️ خرید سرویس"</b> که در منو اصلی ربات قرار دارد، اقدام به خرید سرویس جدید بفرمایید 👇`, { parse_mode: "HTML" });
        return
      }
      const referralBalance = getReferralWalletBalance(chatId)

      bot.sendMessage(chatId, `🛍️ <b>شماره سرویس: </b>${orderId}\n\n${plan.limit_ip > 1 ? "👥" : "👤"} <b>نوع طرح: </b>${plan.limit_ip} کاربره\n${plan.symbol} <b>حجم:</b> ${plan.traffic > 0 ? `${plan.traffic} گیگ` : 'نامحدود'}\n⏰ <b>مدت:</b> ${plan.period} روزه\n\n🎁 <b>قیمت:</b> <s>${plan.original_price} تومان</s>  ⬅️ <b>${plan.final_price} تومان</b> 🎉\n\n${`🌟 <b>تخفیف معرفی دوستان: </b>${Number(String(referralBalance).slice(0, -1)).toLocaleString()} تومان\n\n`}⚠️ <u><b>توجه: پس از تمدید سرویس، حجم و زمان باقیمانده سرویس قبلی از بین خواهد رفت </b></u> ⚠️\n\n😊 برای خرید نهایی روی دکمه "✅ صدور فاکتور" کلیک کنید.`,
        {
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "✅ صدور فاکتور",
                  callback_data: JSON.stringify({
                    act: "gen_order",
                    data: { planId: plan.id, parentId: orderId },
                  }),
                }
              ],
            ],
          },
        }
      );
      break
    }
    case 'renew_show_orders': {
      try {
        const query = `SELECT email FROM client_traffics WHERE inbound_id=${MAIN_INBOUND_ID} AND email LIKE '${user.id}-%' AND email NOT LIKE '%-test-%'`;
        const rows = await api.db(query)
        const configs = [...rows];
        if (configs.length == 0) {
          bot.sendMessage(from.id, "🫠 سرویس جهت تمدید یافت نشد!\n\n🛍️ جهت خرید سرویس جدید از منو پایین اقدام بفرمایید 👇");
          return
        }
        const orders = []
        configs.map(async ({ email }) => {
          const orderId = email.split('-')[1]
          const order = db.data.orders.verified[orderId]
          orders.push([{ text: `${orderId} ${order.plan.symbol}${order.plan.traffic === 0 ? 'نامحدود' : `${order.plan.traffic} گیگ`}-${order.plan.limit_ip} کاربره-${order.plan.period} روزه`, callback_data: JSON.stringify({ act: 'renew_gen', data: { orderId } }) }])
        })
        bot.sendMessage(chatId, `♻️ <b>تمدید سرویس: </b>\n\n⚠️ <u><b>توجه: پس از تمدید سرویس، حجم و زمان باقیمانده سرویس قبلی از بین خواهد رفت </b></u>\n\n😇 لطفا سرویسی که قصد تمدید آن را دارید را انتخاب بفرمایید 👇`, {
          parse_mode: 'HTML',
          reply_markup: {
            inline_keyboard: orders
          }
        })
      } catch (err) {
        console.log(err);
        bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی در دریافت سرویس های شما پیش اومده\n\n😇 لطفا بعد از چند دقیقه دوباره تلاش کنید.");
      }
      break
    }
    case 'edit_plan': {
      const { orderId } = queryData.data
      const order = db.data.orders.verified[orderId]
      if (!order) {
        bot.sendMessage(chatId, '⚠️ این سرویس دیگر در دسترس نمی باشد\n\nلطفا از منو اصلی اقدام به خرید سرویس جدید نمایید 👇');
        return
      }

      const botMsg =
        `<b>🎉 سرویس های 60 روزه اضافه شد 🎉</b>\n\n🔻 سرویس مورد نظر خود را انتخاب کنید🔻`;
      bot.sendMessage(chatId, botMsg, {
        reply_markup: {
          inline_keyboard: plans.map((item) => {
            if (item.active) {
              return [
                {
                  text: item.name
                    .replace("${TRAFFIC}", item.traffic)
                    .replace("${LIMIT_IP}", item.limit_ip)
                    .replace("${SYMBOL}", item.symbol)
                    .replace("${PERIOD}", item.period)
                    .replace("${PRICE}", item.final_price),
                  callback_data: JSON.stringify({
                    act: "edit_gen",
                    data: { orderId, planId: item.id },
                  }),
                },
              ];
            }
            return []
          }),
        },
        parse_mode: "HTML"
      });
      break
    }
    case 'edit_gen': {
      const { orderId, planId } = queryData.data
      const order = db.data.orders.verified[orderId]
      if (!order) {
        bot.sendMessage(chatId, '⚠️ این سرویس دیگر در دسترس نمی باشد\n\nلطفا از منو اصلی اقدام به خرید سرویس جدید نمایید 👇');
        return
      }
      const plan = plans.find((item) => item.id == planId && item.active);
      if (!plan) {
        bot.sendMessage(chatId, `😔 متاسفانه درحال حاضر امکان تمدید این سرویس وجود ندارد.\n\n🙏 لطفا از طریق دکمه <b>"🛍️ خرید سرویس"</b> که در منو اصلی ربات قرار دارد، اقدام به خرید سرویس جدید بفرمایید 👇`, { parse_mode: "HTML" });
        return
      }

      const referralBalance = getReferralWalletBalance(chatId)

      bot.editMessageText(`🛍️ <b>شماره سرویس: </b>${orderId}\n\n${plan.limit_ip > 1 ? "👥" : "👤"} <b>نوع طرح: </b>${plan.limit_ip} کاربره\n${plan.symbol} <b>حجم:</b> ${plan.traffic > 0 ? `${plan.traffic} گیگ` : 'نامحدود'}\n⏰ <b>مدت:</b> ${plan.period} روزه\n\n🎁 <b>قیمت:</b> <s>${plan.original_price} تومان</s>  ⬅️ <b>${plan.final_price} تومان</b> 🎉\n\n${`🌟 <b>تخفیف معرفی دوستان: </b>${Number(String(referralBalance).slice(0, -1)).toLocaleString()} تومان\n\n`}⚠️ <u><b>توجه: پس از تغییر سرویس، حجم و زمان باقیمانده سرویس قبلی از بین خواهد رفت </b></u> ⚠️\n\n😊 برای خرید نهایی روی دکمه "✅ صدور فاکتور" کلیک کنید.`,
        {
          chat_id: chatId,
          message_id: messageId,
          parse_mode: "HTML",
          reply_markup: {
            inline_keyboard: [
              [
                {
                  text: "⬅️ بازگشت",
                  callback_data: JSON.stringify({
                    act: "edit_plan",
                    data: { orderId },
                  }),
                },
                {
                  text: "✅ صدور فاکتور",
                  callback_data: JSON.stringify({
                    act: "gen_order",
                    data: { planId: plan.id, parentId: orderId },
                  }),
                }
              ],
            ],
          },
        }
      );
      break
    }
    default:
      break;
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
    const configs = content?.split('\n')?.slice(0, -1)?.reverse()
    let newContent = ''
    configs.map((config, index) => {
      newContent += (config.replace(/@([^:]+)/, '@turbo.torgod.top').replace(/#.*/, INBOUNDS[environment][index].name) + (configs.length != index + 1 ? '\n' : ''))
    })
    res.setHeader('Content-Type', response.headers['content-type']);
    res.setHeader('Profile-Title', response.headers['profile-title']);
    res.setHeader('Profile-Update-Interval', response.headers['profile-update-interval']);
    res.setHeader('Subscription-Userinfo', response.headers['subscription-userinfo']);
    res.status(200).send(btoa(newContent));
  } catch (err) {
    console.log(err);
  }
});

app.post("/c2c-transaction-verification", async (req, res) => {
  const { content, secret_key } = req.body
  if (secret_key !== process.env.C2C_TRANSACTION_VERIFICATION_SECRET_KEY) {
    res.status(403).json({ msg: "invalid secretkey!", success: false });
    return
  }

  let formattedMessage = "";
  for (let i = 0; i < content.length; i += 4) {
    formattedMessage += "\\u" + content.substr(i, 4);
  }

  const persianText = formattedMessage.replace(/\\u([\d\w]{4})/gi, (match, grp) => {
    return String.fromCharCode(parseInt(grp, 16));
  });

  const bankRegex = /عزیز، ([\d,]+)/;

  const bankMatch = persianText.match(bankRegex);

  if (bankMatch) {
    let price = bankMatch[1];
    const { orders } = db.data

    try {
      for (const orderId in orders.waiting) {
        const order = orders.waiting[orderId];
        if (order.amount == price.replace(/\,/g, '')) {

          const [userId, messageId] = [order.user_id, order.message_id]
          const parentId = order?.parentId
          delete order.message_id
          order.trashMessages.map((msgId) => {
            bot.deleteMessage(userId, msgId);
          })
          delete order.trashMessages
          if (parentId) {
            await vpn.renewConfig(userId, parentId, order.plan)

            orders.verified[parentId] = { ...order, id: parentId, paid_at: moment().format().slice(0, 19), renewed: true }
            delete orders.verified[parentId].parentId
            delete orders.waiting[orderId]
            bot.deleteMessage(userId, messageId);

            if (order?.referral_balance_used) {
              db.data.referral_wallet[userId].balance -= order.referral_balance_used
              db.data.referral_wallet[userId].records.push(
                {
                  type: "withdraw",
                  orderId,
                  amount: order.referral_balance_used
                }
              )
            }

            const user = db.data.users[userId]
            if (user.referral) {
              let profit = parseInt((order.plan.final_price * 10000 * 0.1).toFixed())
              db.data.referral_wallet[user.referral].balance += profit
              db.data.referral_wallet[user.referral].records.push({
                type: "deposit",
                subsetId: `${userId}`,
                subsetOrder: `${orderId}`,
                amount: profit
              })
            }

            bot.sendMessage(userId, `✅ سرویس <b>${parentId}</b> تا تاریخ <b>${order.expire_at.slice(0, 10)}</b> با موفقیت تمدید شد\n\n🔋 <b>حجم: </b>${order.plan.traffic > 0 ? `${order.plan.traffic} گیگ` : 'نامحدود'}\n⏰ <b>مدت: </b>${order.plan.period} روزه\n${order.plan.limit_ip > 1 ? "👥" : "👤"}<b>نوع طرح: </b>${order.plan.limit_ip} کاربره\n💳 <b>هزینه پرداخت شده: </b>${(order.amount).toLocaleString()} ریال`,
              { parse_mode: 'HTML' })
          } else {
            const config = await vpn.addConfig(userId, orderId, order.plan)
            const subLink = vpn.getSubLink(config.subId)
            const subLinkQR = await qrGenerator(subLink)

            orders.verified[order.id] = { ...order, paid_at: moment().format().slice(0, 19) }
            delete orders.waiting[orderId]
            bot.deleteMessage(userId, messageId);

            if (order?.referral_balance_used) {
              db.data.referral_wallet[userId].balance -= order.referral_balance_used
              db.data.referral_wallet[userId].records.push(
                {
                  type: "withdraw",
                  orderId,
                  amount: order.referral_balance_used
                }
              )
            }

            const user = db.data.users[userId]
            if (user.referral) {
              let profit = parseInt((order.plan.final_price * 10000 * 0.1).toFixed())
              db.data.referral_wallet[user.referral].balance += profit
              db.data.referral_wallet[user.referral].records.push({
                type: "deposit",
                subsetId: `${userId}`,
                subsetOrder: `${orderId}`,
                amount: profit
              })
            }

            bot.sendPhoto(userId, subLinkQR, {
              caption: `✅ تراکنش شما با موفقیت تایید شد.\n\n🛍️ <b>شماره سرویس: </b>${order.id}\n🔋 <b>حجم: </b>${order.plan.traffic > 0 ? `${order.plan.traffic} گیگ` : 'نامحدود'}\n⏰ <b>مدت: </b>${order.plan.period} روزه\n${order.plan.limit_ip > 1 ? "👥" : "👤"}<b>نوع طرح: </b>${order.plan.limit_ip} کاربره\n💳 <b>هزینه پرداخت شده: </b>${(order.amount).toLocaleString()} ریال\n\n‼️ <u> لینک پایین را کپی کرده و بر اساس آموزش های زیر، از آن برای دریافت کانفیگ ها در نرم افزارها استفاده کنید </u>\n\n👇 👇 👇 👇 👇 👇 👇`,
              parse_mode: "HTML",
            });
            setTimeout(() => {
              bot.sendMessage(userId, `<code>${subLink}</code>`, { parse_mode: 'HTML' })
            }, 500)
            setTimeout(() => {
              bot.sendMessage(userId, '👆 👆 👆 👆 👆 👆 👆\n\nآخرین نسخه نرم افزار ها به همراه آموزش نحوه اتصال بر اساس سیستم عامل شما در پایین قرار داده شده 👇',
                {
                  parse_mode: 'HTML',
                  reply_markup: JSON.stringify({
                    inline_keyboard: buttons.education,
                    resize_keyboard: true,
                  }),
                })
            }, 2000)
          }
          const user = db.data.users[userId]
          bot.sendMessage(ownerId,
            `🔔 <b>Confirmed by ESP32</b> 🔔\n\n🛍️ <b>Order: </b>${parentId || orderId}\n🍭 <b>Plan: </b>${order.plan.traffic > 0 ? `${order.plan.traffic} Gb` : 'Unlimited'}\n💳 <b>Price: </b>${(order.amount).toLocaleString()}\n♻️ Renew: ${parentId ? 'Yes' : 'No'}\n\n🗣️ <code>${user.tg_name}</code>\n${user.tg_username && `👋 <code>${user.tg_username}</code>`}\n🎗️ <code>${user.id}</code>`,
            { parse_mode: 'HTML' }
          )
          return
        }
      }
    } catch (err) {
      console.error("❌ Error: config_generation> ", err);
      bot.sendMessage(userId, "❌ متاسفانه مشکلی در تایید پرداخت به وجود آمده. لطفا به پشتیبانی پیام دهید 🙏");
      bot.sendMessage(ownerId, "❌ A problem in confirm transaction! 🙏");
    }
  } else {
    console.log('No match found.');
  }

  console.log('⚠️ c2c transaction not found!');
  res.status(404).json({ msg: "transaction not found!", success: false });
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
  key: fs.readFileSync('./certs/torgod.top/torgod.top.key'),
  cert: fs.readFileSync('./certs/torgod.top/fullchain.cer'),
};

const server = https.createServer(certOptions, app);

server.listen(port, '0.0.0.0', async () => {
  dns.lookup(process.env.XUI_BASE_DOMAIN, (err, address, family) => {
    if (err) {
      console.error(err);
      return;
    }
    PANEL_IP = address
    console.log(`\n 🧭 Panel IP: ${address}`);
  });
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

  cron.schedule('*/5 * * * * *', () => {
    updateConfigsTotalUsages()
    checkConfigsTraffics()
  }).start();

  cron.schedule('0 22 * * *', () => {
    checkConfigsExpiration()
    cleanExpiredConfigs()
    cleanExpiredOrders()
    // cleanTrashOrders()
    cleanLogs()
  }).start()

  // if (environment == 'pro') {
  //   cron.schedule('*/15 * * * *', () => {
  //     getBackup()
  //   }).start()
  // }
});




// const docLinks = {
//   withSubLinks: {
//     v2rayNG: "https://telegra.ph/%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-%D8%A7%D9%86%D8%AF%D8%B1%D9%88%DB%8C%D8%AF-%D8%A8%D8%A7-V2rayNG-08-03",
//     hiddify: "https://telegra.ph/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-%D8%A7%D9%86%D8%AF%D8%B1%D9%88%DB%8C%D8%AF-%D8%A8%D8%A7-HiddifyNG-08-03",
//     v2box: "https://telegra.ph/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-IOS-%D8%A8%D8%A7-%D9%86%D8%B1%D9%85-%D8%A7%D9%81%D8%B2%D8%A7%D8%B1-V2Box-08-03",
//   },
//   manually: {
//     v2rayNG: "https://telegra.ph/%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-%D8%A7%D9%86%D8%AF%D8%B1%D9%88%DB%8C%D8%AF-%D8%A8%D8%A7-V2rayNG-07-29",
//     hiddify: "https://telegra.ph/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-%D8%A7%D9%86%D8%AF%D8%B1%D9%88%DB%8C%D8%AF-%D8%A8%D8%A7-HiddifyNG-07-29",
//     v2box: "https://telegra.ph/%D8%A2%D9%85%D9%88%D8%B2%D8%B4-%D8%A7%D8%AA%D8%B5%D8%A7%D9%84-%D8%AF%D8%B1-IOS-%D8%A8%D8%A7-%D9%86%D8%B1%D9%85-%D8%A7%D9%81%D8%B2%D8%A7%D8%B1-V2Box-07-29",
//   }
// }
