import axios from "axios";
import dotenv from "dotenv";
import express from "express";
import { LowSync } from "lowdb";
import { JSONFileSync } from "lowdb/node";
import moment from "moment-timezone";
import cron from 'node-cron';
import TelegramBot from "node-telegram-bot-api";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sqlite3 from 'sqlite3';
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

const TRXWalletAddress = "TLNKTPvGCu5v6KvPuHQ8VN5Pvqwz115UvJ"

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const plans = [
  {
    id: 97,
    name: "${SYMBOL} ${TRAFFIC} گیگ - ${PERIOD} روزه - 💳 ${PRICE} تومان",
    symbol: "🥉",
    traffic: 15,
    period: 30,
    original_price: 75,
    final_price: 55,
    limit_ip: 1,
    version: 1,
    active: true,
  },
  {
    id: 98,
    name: "${SYMBOL} ${TRAFFIC} گیگ - ${PERIOD} روزه - 💳 ${PRICE} تومان",
    symbol: "🥈",
    traffic: 25,
    period: 30,
    original_price: 95,
    final_price: 75,
    limit_ip: 1,
    version: 1,
    active: true,
  },
  {
    id: 99,
    name: "${SYMBOL} ${TRAFFIC} گیگ - ${PERIOD} روزه - 💳 ${PRICE} تومان",
    symbol: "🥇",
    traffic: 50,
    period: 30,
    original_price: 150,
    final_price: 125,
    limit_ip: 1,
    version: 1,
    active: true,
  },
  {
    id: 100,
    name: "${SYMBOL} ${TRAFFIC} گیگ - ${PERIOD} روزه - 💳 ${PRICE} تومان",
    symbol: "🏅",
    traffic: 75,
    period: 30,
    original_price: 200,
    final_price: 180,
    limit_ip: 2,
    version: 1,
    active: true,
  },
  {
    id: 101,
    name: "${SYMBOL} ${TRAFFIC} گیگ - ${PERIOD} روزه - 💳 ${PRICE} تومان",
    symbol: "🎖️",
    traffic: 100,
    period: 30,
    original_price: 229,
    final_price: 199,
    limit_ip: 2,
    version: 1,
    active: true,
  },
  {
    id: 102,
    name: "${SYMBOL} ${TRAFFIC} گیگ - ${PERIOD} روزه - 💳 ${PRICE} تومان",
    symbol: "🎖️",
    traffic: 200,
    period: 30,
    original_price: 419,
    final_price: 379,
    limit_ip: 2,
    version: 1,
    active: true,
  },
];

const INBOUND_ID = environment == 'dev' ? 3 : 2

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
        console.log("requestData: ", requestData);
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
  tronScan: {
    getTransactionInfoByID: async (txid) => {
      return new Promise(async (resolve, reject) => {
        await axios
          .get(process.env.TRON_SCAN + txid)
          .then((response) => {
            resolve(response.data);
          })
          .catch((error) => {
            reject(`API call error [tronScan/getTxInfoByTXID]: ${error}`);
          });
      });
    }
  },
  db: {
    iran: async (query) => {
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
              `API call error [db/iran]: ${error.response.data.message}`
            );
          });
      });
    },
  },
};

const vpn = {
  addConfig: async (userId, orderId, plan) => {
    const config = vpn.createConfigObj(userId, orderId, plan.traffic, plan.period, plan.limit_ip)
    await api.xui.addClient(INBOUND_ID, config)
    return { inbound_id: INBOUND_ID, ...config }
  },
  addTestConfig: async (userId) => {
    const testConfig = vpn.createConfigObj(userId, null, 0.5, 1, 1, true)
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
      limitIp,
      subId: isTest ? `test-${userId}` : orderId,
      tgId: "",
      totalGB: traffic * 1024 * 1024 * 1024
    }
  },
  getSubLink: (subId) => {
    return `${process.env.XUI_SUB}/${subId}`
  }
}

let cooldowns = {};
const COOLDOWN_PERIOD = 1000;

const buttons = {
  mainMenu: [
    ["🛍️ خرید سرویس"],
    ["🔮 سرویس‌ های فعال", "🎁 دریافت تست رایگان",],
    ["🔰 آموزش اتصال"],
    ["☎️ پشتیبانی مالی", "🫂 پشتیبانی فنی"],
  ],
  education: [
    [{
      text: '🍀 اندروید - Android 🍀',
      url: 'https://t.me/nova_vpn_channel/25'
    }],
    [{
      text: '🍎 آیفون - IOS 🍎',
      url: 'https://t.me/nova_vpn_channel/19'
    }],
    [{
      text: '🖥️ ویندوز - Windows 🖥️',
      url: 'https://t.me/nova_vpn_channel/24'
    }],
    [{
      text: '💻 مک او اس - MacOS 💻',
      url: 'https://t.me/nova_vpn_channel/18'
    }],
  ]
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

const cleanExpiredOrders = async () => {
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
        bot.sendMessage(userId, `🫠 متاسفانه زمان انجام تراکنش برای سفارش ${orderId} به اتمام رسید.\n\n😇 لطفا از منو زیر مجددا اقدام به خرید سرویس بفرمایید 👇`, { parse_mode: "HTML" })
        db.write()
      }
    }
  } catch (err) {
    console.error("❌ Error: cleanExpiredOrders> ", err);
  }
}

const checkWaitingOrdersWithTXID = async () => {
  const { orders } = db.data
  try {
    for (const orderId in orders.waiting) {
      const order = orders.waiting[orderId];
      if (order?.txid) {
        const transactionInfo = await api.tronScan.getTransactionInfoByID(order.txid)
        const orderCreatedtime = moment.tz(order.created_at, 'Asia/Tehran').valueOf();
        const { confirmed, contractData, timestamp } = transactionInfo

        if (
          !contractData ||
          timestamp <= orderCreatedtime ||
          contractData.to_address != TRXWalletAddress ||
          contractData.amount * 1e-6 != order.amount
        ) {
          delete order.txid
          db.write()
          bot.sendMessage(order.user_id,
            `❌ متاسفانه TXID وارد شده در شبکه یافت نشد و یا مربوط به سفارش ${order.id} نبوده است.\n\n🙏 لطفا TXID وارد شده را مجدد بررسی نموده و از طریق دکمه "<b>⬆️ ارسال TXID</b>" که در زیر فاکتور شما قرار داشت اقدام به ارسال مجدد مقدار درست TXID بفرمایید.`,
            { parse_mode: "HTML" }
          ).then((botMsg) => {
            order.trashMessages.push(botMsg.message_id)
            db.write()
          });
          continue
        }

        if (confirmed) {
          const [userId, messageId] = [order.user_id, order.message_id]
          delete order.message_id
          order.trashMessages.map((msgId) => {
            bot.deleteMessage(userId, msgId);
          })
          delete order.trashMessages
          orders.verified[order.id] = { ...order, paid_at: moment().format().slice(0, 19) }
          delete orders.waiting[orderId]
          bot.deleteMessage(userId, messageId);

          const config = await vpn.addConfig(userId, orderId, order.plan)
          db.data.users[userId].configs.push({
            ...config,
            orderId: order.id
          })
          db.write()
          const subLink = vpn.getSubLink(config.subId)
          bot.sendMessage(userId,
            `✅ پرداخت شما برای سفارش ${orderId} با موفقیت تایید شد.\n\n♻️ <b>لینک آپدیت خودکار:</b>\n<code>${subLink}</code>`,
            {
              parse_mode: "HTML",
              reply_markup: JSON.stringify({
                keyboard: buttons.mainMenu,
                resize_keyboard: true,
              }),
            }
          );
          const botMsg = '👇 لینک‌های آموزش اتصال به سرویس 👇'
          setTimeout(() => bot.sendMessage(userId, botMsg, {
            reply_markup: {
              inline_keyboard: buttons.education,
            },
            parse_mode: "HTML"
          }), 500)
        }
      }
    }
  } catch (err) {
    console.error("❌ Error: checkWaitingOrdersWithTXID> ", err);
    bot.sendMessage(orders.user_id, "❌ متاسفانه مشکلی در تایید پرداخت یا ساخت کانفیگ به وجود آمده. لطفا به پشتیبانی پیام دهید 🙏");
  }
}

const cleanExpiredConfigs = async () => {
  try {
    const query = 'SELECT email FROM client_traffics WHERE enable = 0';
    const rows = await api.db.iran(query)
    const expiredConfigs = rows.map((row) => row.email);
    if (expiredConfigs.length > 0) {
      try {
        await api.xui.depletedClients()
      } catch (err) {
        console.log("Error in cleanExpiredConfigs>api.xui.depletedClients: ", err);
      }
      expiredConfigs.map((email) => {
        const [userId, orderId] = email.split('-')
        if (orderId != 'test') {
          const configs = db.data.users[userId].configs
          db.data.users[userId].configs = configs.filter((config) => config.email !== email)
        }
      })
      db.write()
    }
  } catch (err) {
    console.log(err);
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
      bot.sendMessage(userId, "😊 جهت استفاده از ربات، ابتدا در کانال زیر عضو شده و سپس بر روی /start کلیک 👇",
        {
          reply_markup: {
            inline_keyboard: [[{ text: "🪐 NOVA VPN 🪐", url: "https://t.me/nova_vpn_channel" }]]
          }, parse_mode: 'HTML'
        }
      );
      return false
    }
  } catch (err) {
    console.error('Error:', err);
    return false
  }
  return true
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
      test_config: null,
      configs: [],
      created_at: moment().format().slice(0, 19)
    }
    db.write();
  }
  bot.sendMessage(from.id, "😇 به ربات <b>NOVA</b> خوش آمدید 🌹\n\n🎁 جهت دریافت تست <b>رایگان</b>، از منوی زیر اقدام بفرمایید 👇", {
    reply_markup: JSON.stringify({
      keyboard: buttons.mainMenu,
      resize_keyboard: true,
    }),
    parse_mode: 'HTML'
  });
});

bot.onText(/🎁 دریافت تست رایگان/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (user.test_config) {
    bot.sendMessage(
      from.id,
      "🙃 شما قبلا تست رایگان را دریافت نموده‌اید.\n\n😇 لطفا درصورت رضایت از کیفیت سرویس، از منو پایین اقدام به خرید سرویس بفرمایید 👇"
    );
    return;
  }
  try {
    const testConfig = await vpn.addTestConfig(user.id)
    const subLink = vpn.getSubLink(testConfig.subId)
    user.test_config = testConfig
    db.write()
    bot.sendMessage(from.id, `🥳 تبریک میگم!\n✅ کانفیگ تست شما با موفقیت ساخته شده\n\n🎁 حجم: ۵۰۰ مگابایت\n⏰ مدت استفاده: ۲۴ ساعت\n\n♻️ لینک آپدیت خودکار:\n<code>${subLink}</code>`, { parse_mode: "HTML" });
    const botMsg = '👇 لینک‌های آموزش اتصال به سرویس 👇'
    setTimeout(() => bot.sendMessage(from.id, botMsg, {
      reply_markup: {
        inline_keyboard: buttons.education,
      },
      parse_mode: "HTML"
    }), 500)
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
    `😇 جهت اطمینان، حتما از منو اصلی اقدام به "<b>🎁 دریافت تست رایگان</b>" بفرمایید.\n\n😊 در غیر اینصورت جهت ادامه خرید بر روی دکمه زیر بزنید.`,
    {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            {
              text: "🛍️ ادامه خرید",
              callback_data: JSON.stringify({ action: "store" }),
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
  if (!user?.configs?.length != 0) {
    bot.sendMessage(from.id, "🫠 در حال حاضر هیچ سرویس فعالی ندارید\n\n🛍️ جهت خرید از منو پایین اقدام بفرمایید 👇");
    return
  }
  try {
    let botMsg = ""
    const query = `SELECT email, up, down, total, enable FROM client_traffics WHERE inbound_id=${INBOUND_ID} AND email LIKE '${user.id}-%' AND email NOT LIKE '%-test'`;
    const rows = await api.db.iran(query)
    const configs = [...rows];
    console.log("configs: ", configs);
    if (configs.length > 0) {
      configs.map(({ email, up, down, total, enable }) => {
        const orderId = email.split('-')[1]
        const { paid_at, expire_at } = db.data.orders.verified[orderId]
        let remainingTraffic = ((total - up - down) / 1024 / 1024 / 1024).toFixed(2)
        remainingTraffic = remainingTraffic > 0 ? remainingTraffic : 0
        const subLink = vpn.getSubLink(orderId)
        botMsg = `\n\n\n🛍️ <b>شماره سفارش: </b>${orderId}\n🪫 <b>حجم باقیمانده: </b>${remainingTraffic} گیگ\n⏱️ <b>تاریخ تحویل: </b>${paid_at.slice(0, 10)}\n📅 <b>تاریخ انقضا: </b>${expire_at.slice(0, 10)}\n👀 <b>وضعیت سفارش: ${enable ? '✅ فعال' : '❌ غیر فعال'}</b>${enable ? `\n♻️ <b>لینک اپدیت خودکار: </b>\n<code>${subLink}</code>` : ''}` + botMsg
      })
      bot.sendMessage(from.id, botMsg, { parse_mode: "HTML" });
    }
  } catch (err) {
    console.log(err);
    bot.sendMessage(from.id, "🤕 اوه اوه!\n🤔 فکر کنم مشکلی در دریافت سرویس های شما پیش اومده\n\n😇 لطفا بعد از چند دقیقه دوباره تلاش کنید.");
  }
});

bot.onText(/🔰 آموزش اتصال/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const botMsg = '👇 لینک‌های آموزش اتصال به سرویس 👇'
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
  const botMsg = `😇 <b>لطفا ابتدا موارد زیر را بررسی بفرمایید 👇</b>\n\n1️⃣ از بخش "🔮سرویس‌های فعال" حجم و زمان باقی مانده سفارش را بررسی کنید.\n\n2️⃣ اتصال به اینترنت را بدون استفاده از vpn بفرمایید.\n\n3️⃣ ترجیحا از نرم افزارهایی که در کانال معرفی شده استفاده کنید.\n\n4️⃣ در نرم افزار v2rayNG طبق آموزش allowInsecure را true کنید.\n\n😇 همچنین میتوانید مشکل خود را در گروه NOVA ارسال بفرمایید 👇`
  bot.sendMessage(from.id, botMsg,
    {
      reply_markup: {
        inline_keyboard: [[{ text: "🫂 گروه پرسش و پاسخ", url: "https://t.me/+9Ry1urzfT-owMzVk" }]]
      }, parse_mode: "HTML"
    }
  );
});

bot.onText(/☎️ پشتیبانی مالی/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const botMsg = `<b>آیا فراموش کردین TXID را کپی کنید؟</b> 🙃\n\nدر سایت زیر وارد شده و مراحل ذکر شده را انجام دهید و TXID را از طریق دکمه "<b>⬆️ ارسال TXID</b>" که در زیر فاکتور شما قرار داشت، ارسال بفرمایید.\n\n🖥️ <b>آدرس سایت: </b><a href='https://digiswap.org'>digiswap.org</a>\n\n🟢 <b>مراحل: </b>ورود/ثبت نام =» حساب کاربری =» سفارشات =» جزئیات\n\n‼️ <b>حتما با همان شماره موبایلی که پرداخت را انجام دادید وارد سایت بشوید</b> ‼️`;
  bot.sendMessage(from.id, botMsg, {
    reply_markup: {
      inline_keyboard: [[{ text: "☎️ پشتیبان مالی", url: "t.me/nova_vpn_support" }]]
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

  if (queryData.action === "store") {
    const botMsg =
      "🔻 لطفا طرح مورد نظر خود را انتخاب کنید 🔻";
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
                  .replace("${PERIOD}", item.period)
                  .replace("${SYMBOL}", item.symbol)
                  .replace("${PRICE}", item.final_price),
                callback_data: JSON.stringify({
                  action: "plan_detailes",
                  data: { planId: item.id },
                }),
              },
            ];
          }
        }),
      },
      parse_mode: "HTML"
    });
  }

  if (queryData.action === "plan_detailes") {
    const plan = plans.find((item) => item.id == queryData.data.planId);

    const botMsg = `${plan.symbol} <b>حجم:</b> ${plan.traffic} گیگ\n⏰ <b>مدت:</b> ${plan.period} روزه\n${plan.limit_ip > 1 ? "👥" : "👤"} <b>نوع طرح:</b> ${plan.limit_ip > 1 ? "چند" : "تک"} کاربره\n💳 <b>قیمت:</b> <s>${plan.original_price} تومان</s>  ⬅️ <b>${plan.final_price} تومان</b> 🎉\n\nبرای صدور فاکتور و خرید نهایی روی دکمه "✅ صدور فاکتور" کلیک کنید.`

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
      const rate = await api.digiswap.getRates()
      const amount = ((((plan.final_price * 1000) - rate.fee) / rate.tronPrice) - ((Math.floor(Math.random() * 20) + 1) * 0.01)).toFixed(2)
      const paymentLimitTime = moment().add(1800000) // 30 min

      const paymentLink = `https://digiswap.org/quick?amount=${amount}&address=${TRXWalletAddress}`

      const order = {
        id: orderId,
        user_id: from.id,
        message_id: messageId,
        trashMessages: [],
        plan: {
          ...plan,
          name: plan.name
            .replace("${TRAFFIC}", plan.traffic)
            .replace("${PERIOD}", plan.period)
            .replace("${SYMBOL}", plan.symbol)
            .replace("${PRICE}", plan.final_price),
        },
        amount,
        rate,
        created_at: moment().format().slice(0, 19),
        expire_at: moment().add(plan.period * 24 * 60 * 60 * 1000).format().slice(0, 19),
        payment_limit_time: paymentLimitTime.valueOf()
      };
      db.data.orders.waiting[orderId] = order;
      db.write();

      bot.editMessageText(
        `🌟 جهت پرداخت هزینه سرویس مبلغ <u><b>دقیق</b></u> زیر را به شماره کارت ذکر شده حداکثر تا ساعت <u><b>${paymentLimitTime.format().slice(11, 16)}</b></u> ارسال بفرمایید.\n\n💳 <b>شماره کارت:\n</b>6219-8619-1150-4420\n\n👤 <b>صاحب حساب: </b>محمدامین مویدی\n\n💸 <b>مبلغ نهایی: </b><code>${amount}</code> ریال\n(بر روی اعداد مبلغ بزنید تا کپی شود)\n\n❌ <b><u>توجه: تمامی اعداد مبلغ نهایی سرویس جهت تایید تراکنش بسیار مهم بوده و باید با دقت وارد شود</u></b>\n\n✅  لطفا تصویر رسید واریزی خود را برای آی دی زیر ارسال بفرمایید\n👉 @nova_vpn_support\n\n🌈 <b>شماره سفارش: </b>${orderId}\n\n🟡 <b>آخرین وضعیت: </b>درانتظار پرداخت`,
        {
          parse_mode: "HTML",
          chat_id: chatId,
          message_id: messageId,
          reply_markup: {
            inline_keyboard: [[
              {
                text: "⬆️ ارسال TXID",
                callback_data: JSON.stringify({
                  action: "send_txid",
                  data: { orderId },
                }),
              },
              {
                text: "💸 لینک پرداخت",
                url: paymentLink,
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

  if (queryData.action === "send_txid") {
    const { orderId } = queryData.data
    let order = db.data.orders.waiting[orderId]

    bot.sendMessage(chatId, "🔻 لطفا TXID که پس از پرداخت موفق دریافت نمودید را وارد کنید 🔻", {
      reply_markup: {
        force_reply: true,
      }
    }).then((sentBotMsg) => {
      order.trashMessages.push(sentBotMsg.message_id)
      db.write()

      bot.onReplyToMessage(chatId, sentBotMsg.message_id, (userMsg) => {
        order.txid = userMsg.text
        bot.sendMessage(chatId, `🌈 <b>شماره سفارش:</b> ${orderId}\n\n🏷️ <b>ای دی تراکنش: </b>${userMsg.text}\n\n🔰 <b>آخرین وضعیت: 🟡 در انتظار تایید</b>\n\n‼️ به محض تایید در شبکه بلاک چین، سفارش شما <u><b>بصورت خودکار</b></u> تحویل داده خواهد شد.\n\n⚠️ درصورتی که مقدار TXID را اشتباه وارد کردید میتوانید با زدن دکمه \"<b>⬆️ ارسال TXID</b>\" که در زیر فاکتور سفارش قرار دارد، TXID جدید را ارسال بفرمایید.`,
          {
            reply_markup: JSON.stringify({
              keyboard: buttons.mainMenu,
              resize_keyboard: true,
            }),
            parse_mode: "HTML"
          }
        ).then((sentMessage) => {
          order.trashMessages.push(sentMessage.message_id, userMsg.message_id)
          db.write()
        })
      })
    })
  }
});

bot.on("polling_error", (error) => {
  console.log(error);
});

app.get("/", (req, res) => {
  res.send("🚀 Bot is running ✅");
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
app.listen(port, '0.0.0.0', async () => {
  console.log('\n\n', `${environment == 'dev' ? "🧪 DEVELOPMENT" : "🚨 PRODUCTION"}  ⛩️ PORT: ${port}`);
  await api.xui.login()
  cron.schedule('0 0 */25 * *', () => {
    checkXUISessionExpiration()
  }).start();
  cron.schedule('*/1 * * * * *', () => {
    cleanExpiredCooldown()
    cleanExpiredOrders()
  }).start();

  cron.schedule('* * * * *', () => {
    checkWaitingOrdersWithTXID()
  })
  cron.schedule('0 */24 * * *', () => {
    cleanExpiredConfigs()
  }).start();
  cleanExpiredConfigs()
});
