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
const file = join(__dirname, "./db.json");
const adapter = new JSONFileSync(file);
const defaultData = { users: {}, orders: { waiting: {}, verified: {}, expired: {} } };
const db = new LowSync(adapter, defaultData);
db.read();

const xuiDbPath = '/etc/x-ui/x-ui.db';

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

const INBOUND = {
  id: 1,
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
            console.log("Response:", response.data);
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
            console.log("Response:", response.data);
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
  weswap: {
    getRates: async () => {
      return new Promise(async (resolve, reject) => {
        await axios
          .get(process.env.WESWAP + "/rate")
          .then((response) => {
            if (response.data.status != 200) {
              throw response.data.msg;
            }
            resolve(response.data.result);
          })
          .catch((error) => {
            reject(`API call error [weswap/getRates]: ${error}`);
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
            console.log('\n\n✅ [X-UI panel] login successfully \n\n');
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
          .post(process.env.XUI_API + `/delDepletedClients/${INBOUND.id}`, null, options)
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
  }
};

const vpn = {
  addConfig: async (userId, orderId, plan) => {
    const config = vpn.createConfigObj(userId, orderId, plan.traffic, plan.period, plan.limit_ip)
    await api.xui.addClient(INBOUND.id, config)
    return { inbound_id: INBOUND.id, ...config }
  },
  addTestConfig: async (userId) => {
    const testConfig = vpn.createConfigObj(userId, null, 0.5, 1, 1, true)
    await api.xui.addClient(INBOUND.id, testConfig)
    return { inbound_id: INBOUND.id, ...testConfig }
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
        bot.sendMessage(userId, `❌ زمان انجام تراکنش برای سفارش ${orderId} به اتمام رسید.\n\n✅ درصورتی که هزینه سرویس را به درستی به کارت مقصد ارسال نمودین اما به صورت خودکار از سمت ما تایید نشده، لطفا رسید پرداخت را برای پشتیبانی ارسال بفرمایید. \n\nدر غیر این صورت لطفا با زدن دکمه <b>«🚀 خرید سرویس VPN»</b> از منوی اصلی اقدام به ثبت و پرداخت سفارش جدید بفرمایید.`, { parse_mode: "HTML" })
        db.write()
      }
    }
  } catch (err) {
    console.error("❌ Error: config_generation> ", err);
    bot.sendMessage(userId, "❌ متاسفانه مشکلی در تایید پرداخت یا ساخت کانفیگ به وجود آمده. لطفا به پشتیبانی پیام دهید 🙏");
  }
}

const cleanExpiredConfigs = () => {
  try {
    const xuiDb = new sqlite3.Database(xuiDbPath, (err) => {
      if (err)
        throw `Error connecting to the database: ${err}`;
      const query = 'SELECT email FROM client_traffics WHERE enable = 0';
      xuiDb.all(query, async (error, rows) => {
        if (error)
          throw `Error executing query: ${err}`;
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
        xuiDb.close((err) => {
          if (err)
            throw `Error closing the database connection: ${err}`;
        });
      });
    });
  } catch (err) {
    console.log(err);
  }
}

const baseChecking = async (userId, isStartCommand) => {
  if (isOnCooldown(userId)) return false
  if (!isStartCommand) {
    const user = db.data.users[userId]
    if (!user) {
      bot.sendMessage(userId, "❌ متاسفانه مشکلی پیش آمده.\n لطفا بر روی /start بزنید.");
      return false
    }
  }
  try {
    const channelSubscription = await bot.getChatMember('@dedicated_vpn_channel', userId)
    if (channelSubscription.status !== 'member' && channelSubscription.status !== 'creator' && channelSubscription.status !== 'administrator') {
      bot.sendMessage(userId, "⚠️ برای استفاده از ربات ابتدا در کانال ما عضو شوید و سپس بر روی /start بزنید.\n\n💎 👈 <u><a href='https://t.me/dedicated_vpn_channel'>عضویت در کانال</a></u> 👉 💎", { parse_mode: 'HTML' });
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
  bot.sendMessage(from.id, "😇 به بات فروش سرویس VPN اختصاصی خوش آمدید\n\n😋 برای دریافت کانفیگ رایگان، روی دکمه «🎁 دریافت تست رایگان» در منو اصلی بزنید تا کانفیگ تست را دریافت نمایید", {
    reply_markup: JSON.stringify({
      keyboard: [
        ["🎁 دریافت تست رایگان", "🚀 خرید سرویس VPN"],
        ["🛒 سفارشات من", "👨🏼‍🏫 آموزش اتصال"],
        ["💰 پشتیبانی مالی", "👨🏻‍💻 پشتیبانی فنی"],
      ],
      resize_keyboard: true,
    }),
  });
});

bot.onText(/ok/, async ({ from, text }) => {
  const baseCheckingStatus = await baseChecking(from.id, true)
  if (!baseCheckingStatus) return

  if (from.id == 1085276188) {
    const { orders } = db.data
    let userId, messageId

    try {
      const pattern = /ok\s(\d{1,3}(,\d{3})*)/;
      const match = text.match(pattern);
      const price = match[1]

      for (const orderId in orders.waiting) {
        const order = orders.waiting[orderId];
        if (order.amount == price) {
          [userId, messageId] = [order.user_id, order.message_id]
          delete order.message_id
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
          bot.sendMessage(userId, `✅ پرداخت شما برای سفارش ${orderId} با موفقیت تایید شد.\n\n♻️ <b>لینک آپدیت خودکار:</b>\n<code>${subLink}</code>`, { parse_mode: "HTML" });
          const botMsg = '😇 جهت مشاهده نحوه اتصال به سرویس سیستم عامل خود را انتخاب کنید 🔻'
          setTimeout(() => bot.sendMessage(userId, botMsg, {
            reply_markup: {
              inline_keyboard: [
                [{
                  text: '📱 اندروید - Android 📱',
                  url: 'https://t.me/dedicated_vpn_channel/25'
                }],
                [{
                  text: '📱 آی او اس - IOS 📱',
                  url: 'https://t.me/dedicated_vpn_channel/19'
                }],
                [{
                  text: '🖥️ ویندوز - Windows 🖥️',
                  url: 'https://t.me/dedicated_vpn_channel/24'
                }],
                [{
                  text: '💻 مک او اس - MacOS 💻',
                  url: 'https://t.me/dedicated_vpn_channel/18'
                }],
              ],
            },
            parse_mode: "HTML"
          }), 500)

          bot.sendMessage(from.id, '✅ Done ✅')
          return
        }
      }
      bot.sendMessage(from.id, '⚠️ Not Found ⚠️')
    } catch (err) {
      console.error("❌ Error: config_generation> ", err);
      bot.sendMessage(userId, "❌ متاسفانه مشکلی در تایید پرداخت یا ساخت کانفیگ به وجود آمده. لطفا به پشتیبانی پیام دهید 🙏");
      bot.sendMessage(from.id, '❌ Failed ❌')
    }
  }
});

bot.onText(/🎁 دریافت تست رایگان/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (user.test_config) {
    bot.sendMessage(
      from.id,
      "❌ امکان دریافت کانفیگ تست برای شما مقدور نیست. (شما قبلا کانفیگ تست را دریافت نموده‌ای)"
    );
    return;
  }
  try {
    const testConfig = await vpn.addTestConfig(user.id)
    const subLink = vpn.getSubLink(testConfig.subId)
    user.test_config = testConfig
    db.write()
    bot.sendMessage(from.id, `✅ کانفیگ تست با موفقیت ساخته شده.\n\n⚠️ این کانفیگ شامل ۵۰۰ مگابایت حجم رایگان بوده و ۲۴ ساعت اعتبار دارد.\n\n📡 از کانفیگ تست میتوانید برای بررسی ارتباط، سرعت و پایداری سرویس با اپراتور خود استفاده کنید.\n\n♻️ لینک آپدیت خودکار:\n<code>${subLink}</code>`, { parse_mode: "HTML" });
    const botMsg = '😇 جهت مشاهده نحوه اتصال به سرویس سیستم عامل خود را انتخاب کنید 🔻'
    setTimeout(() => bot.sendMessage(from.id, botMsg, {
      reply_markup: {
        inline_keyboard: [
          [{
            text: '📱 اندروید - Android 📱',
            url: 'https://t.me/dedicated_vpn_channel/25'
          }],
          [{
            text: '📱 آی او اس - IOS 📱',
            url: 'https://t.me/dedicated_vpn_channel/19'
          }],
          [{
            text: '🖥️ ویندوز - Windows 🖥️',
            url: 'https://t.me/dedicated_vpn_channel/24'
          }],
          [{
            text: '💻 مک او اس - MacOS 💻',
            url: 'https://t.me/dedicated_vpn_channel/18'
          }],
        ],
      },
      parse_mode: "HTML"
    }), 500)
  } catch (e) {
    console.error("❌ Error: test_config_generation> ", e);
    bot.sendMessage(from.id, "❌ مشکلی در ساخت کافیگ تست رخ داده است. لطفا دوباره تلاش کنید 🙏");
  }
});

bot.onText(/🚀 خرید سرویس VPN/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "❌ متاسفانه مشکلی پیش آمده.\n لطفا بر روی /start بزنید.");
    return
  }
  bot.sendMessage(
    from.id,
    "🔻 شرایط و قوانین استفاده از سرویس:\n\n۱) 🌟حتما قبل از خرید سرویس، از منو اصلی بات، کانفیگ تست را دریافت نموده تا از توانایی اتصال به سرویس های ما با استفاده از اپراتور خودتان مطمئن شوید. (در غیر این صورت مسئولیت خرید بر عهده کاربر است)\n\n۲) 📡  سرویس ما در تمام ساعات روز برای شما عزیزان قابل دسترس است مگر اینکه اختلال کلی در زیرساخت کشور وجود داشته باشد که در این صورت باید صبر کنید تا اختلال های زیرساخت کشور برطرف شود.\n\n۳) 🕵🏻‍♂️ خرید سرویس از طریق کارت به کارت صورت میگیرد و از تکنولوژی تایید خودکار تراکنش استفاده میشود (به این صورت که پس از دریافت تراکنش از سمت شما به کارت مقصد، کانفیگ ها به صورت خودکار ساخته و تحویل داده میشود. (اما کاربر همچنان موظف به ذخیره رسید کارت به کارت برای مواقع خاص میباشد).\n\n😇 ایا شرایط را می پذیرید؟",
    {
      reply_markup: JSON.stringify({
        inline_keyboard: [
          [
            {
              text: "🫡 شرایط را خوانده و میپذیرم",
              callback_data: JSON.stringify({ action: "store" }),
            },
          ],
        ],
      }),
    });
});

bot.onText(/🛒 سفارشات من/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "❌ متاسفانه مشکلی پیش آمده.\n لطفا بر روی /start بزنید.");
    return
  }
  if (user.configs.length == 0) {
    bot.sendMessage(from.id, "⚠️ شما درحال حاضر هیچ کانفیگ خریداری شده ای ندارید.\n\n🙏 لطفا با زدن دکمه خرید سرویس از منو اصلی اقدام به خرید کانفیگ کنید.");
    return
  }
  try {
    let botMsg = ""
    const xuiDb = new sqlite3.Database(xuiDbPath, (err) => {
      if (err)
        throw `Error connecting to the database: ${err}`;
      const query = `SELECT email, up, down, total, enable FROM client_traffics WHERE email LIKE '${user.id}-%' AND email NOT LIKE '%-test'`;
      xuiDb.all(query, async (error, rows) => {
        if (error)
          throw `Error executing query: ${err}`;
        const configs = [...rows];
        if (configs.length > 0) {
          configs.map(({ email, up, down, total, enable }) => {
            const orderId = email.split('-')[1]
            const { paid_at, expire_at } = db.data.orders.verified[orderId]
            let remainingTraffic = ((total - up - down) / 1024 / 1024 / 1024).toFixed(2)
            remainingTraffic = remainingTraffic > 0 ? remainingTraffic : 0
            const subLink = vpn.getSubLink(orderId)
            botMsg = `\n\n\n🌈 <b>شماره سفارش: </b>${orderId}\n🥇 <b>حجم باقیمانده: </b>${remainingTraffic} گیگ\n⏱️ <b>تاریخ تحویل: </b>${paid_at.slice(0, 10)}\n📅 <b>تاریخ انقضا: </b>${expire_at.slice(0, 10)}\n👀 <b>وضعیت سفارش: ${enable ? '✅ فعال' : '❌ غیر فعال'}</b>${enable ? `\n♻️ <b>لینک اپدیت: </b>\n<code>${subLink}</code>` : ''}` + botMsg
          })
          bot.sendMessage(from.id, botMsg, { parse_mode: "HTML" });
        }
        xuiDb.close((err) => {
          if (err)
            throw `Error closing the database connection: ${err}`;
        });
      });
    });
  } catch (err) {
    console.log(err);
    bot.sendMessage(from.id, "❌ متاسفانه مشکلی در دریافت سفارشات شما بوجود آمده است.\n🙏 لطفا پس از چند دقیقه دوباره تلاش کنید.");
  }
});

bot.onText(/👨🏼‍🏫 آموزش اتصال/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const botMsg = '😇 جهت مشاهده نحوه اتصال به سرویس سیستم عامل خود را انتخاب کنید 🔻'
  bot.sendMessage(from.id, botMsg, {
    reply_markup: {
      inline_keyboard: [
        [{
          text: '📱 اندروید - Android 📱',
          url: 'https://t.me/dedicated_vpn_channel/25'
        }],
        [{
          text: '📱 آی او اس - IOS 📱',
          url: 'https://t.me/dedicated_vpn_channel/19'
        }],
        [{
          text: '🖥️ ویندوز - Windows 🖥️',
          url: 'https://t.me/dedicated_vpn_channel/24'
        }],
        [{
          text: '💻 مک او اس - MacOS 💻',
          url: 'https://t.me/dedicated_vpn_channel/18'
        }],
      ],
    },
    parse_mode: "HTML"
  });
});

bot.onText(/👨🏻‍💻 پشتیبانی فنی/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "❌ متاسفانه مشکلی پیش آمده.\n لطفا بر روی /start بزنید.");
    return
  }
  const botMsg = `⚠️ ابتدا مراحل اتصال را از بخش <b>«👨🏻‍🏫 آموزش اتصال»</b> چک بفرمایید و بعد این موارد را بررسی کنید:\n\n۱) از بخش سفارشات من حجم و زمان باقی مانده سفارش را بررسی کنید.\n\n۲) اتصال به اینترنت را بدون استفاده از vpn چک کنید.\n\n۳) حتما از فایل نرم افزارهایی که ربات برای شما ارسال میکند استفاده کنید (زیرا تفاوت نسخه ها بعضا باعث عدم اتصال میشود)\n\n۴) درصورتی که برای اندروید از v2rayNG استفاده میکنید حتما درقسمت ادیت کانفیگ گزینه ی allowInsecure را true کنید\n\n\nاگر همچنان در اتصال مشکل دارین در گروه زیر مشکلتون رو مطرح بفرمایید:\n\n👥 <a href="https://t.me/+9Ry1urzfT-owMzVk">برای عضویت در گروه کلیک کنید</a> 👥`
  bot.sendMessage(from.id, botMsg, { parse_mode: "HTML" });
});

bot.onText(/💰 پشتیبانی مالی/, async ({ from }) => {
  const baseCheckingStatus = await baseChecking(from.id)
  if (!baseCheckingStatus) return
  const botMsg =
    "درصورتی که مبلغ دقیق سرویس را با موفقیت به کارت مقصد ارسال کردین ولی کانفیگ را پس از گذشت حداکثر ۱۵ دقیقه دریافت نکردین، میتوانید به پشتیبانی پیام داده و رسید خود را ارسال بفرمایید تا در اسرع وقت بررسی شود.\n\n🫂 پشتیبانی مالی : @dedicated_vpn_support";
  bot.sendMessage(from.id, botMsg);
});

bot.on("callback_query", async (query) => {
  const { message, from, data } = query;
  if (isOnCooldown(from.id)) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "❌ متاسفانه مشکلی پیش آمده.\n لطفا بر روی /start بزنید.");
    return
  }
  const chatId = from.id;
  const messageId = message.message_id;
  const queryData = JSON.parse(data);

  if (queryData.action === "generate_order") {
    const plan = plans.find((item) => item.id == queryData.data.planId);
    try {
      const orderId = Math.floor(Math.random() * (999999999 - 100000000 + 1)) + 100000000;
      const code = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000
      const amount = ((plan.final_price * 10000) + code).toLocaleString()
      const createdAt = moment().format().slice(0, 19)
      const paymentLimitTime = moment().add(7200000) // 2 hours

      const order = {
        id: orderId,
        user_id: from.id,
        message_id: messageId,
        plan: {
          ...plan,
          name: plan.name
            .replace("${TRAFFIC}", plan.traffic)
            .replace("${PERIOD}", plan.period)
            .replace("${SYMBOL}", plan.symbol)
            .replace("${PRICE}", plan.final_price),
        },
        amount,
        created_at: createdAt,
        expire_at: moment().add(plan.period * 24 * 60 * 60 * 1000).format().slice(0, 19),
        payment_limit_time: paymentLimitTime.valueOf()
      };
      db.data.orders.waiting[orderId] = order;
      db.write();

      bot.editMessageText(
        `🌟 جهت پرداخت هزینه سرویس مبلغ <u><b>دقیق</b></u> زیر را به شماره کارت ذکر شده حداکثر تا ساعت <u><b>${paymentLimitTime.format().slice(11, 16)}</b></u> ارسال بفرمایید.\n\n💳 <b>شماره کارت:\n</b>6219-8619-1150-4420\n\n👤 <b>صاحب حساب: </b>محمدامین مویدی\n\n💸 <b>مبلغ نهایی: </b><code>${amount}</code> ریال\n(بر روی اعداد مبلغ بزنید تا کپی شود)\n\n❌ <b><u>توجه: تمامی اعداد مبلغ نهایی سرویس جهت تایید تراکنش بسیار مهم بوده و باید با دقت وارد شود</u></b>\n\n✅  لطفا تصویر رسید واریزی خود را برای آی دی زیر ارسال بفرمایید\n👉 @dedicated_vpn_support\n\n🌈 <b>شماره سفارش: </b>${orderId}\n\n🟡 <b>آخرین وضعیت: </b>درانتظار پرداخت`,
        {
          parse_mode: "HTML",
          chat_id: chatId,
          message_id: messageId
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
});

bot.on("polling_error", (error) => {
  console.log(error);
});

app.get("/", (req, res) => {
  res.send("🚀 Bot is running ✅");
});

app.post("/c2c-transaction-verification", async (req, res) => {
  const { content, secret_key } = req.body
  if (secret_key !== process.env.C2C_TRANSACTION_VERIFICATION_SECRET_KEY) {
    res.status(403).json({ msg: "invalid secretkey!", success: false });
    return
  }
  console.log("content: ", content);

  let formattedMessage = "";
  for (let i = 0; i < content.length; i += 4) {
    formattedMessage += "\\u" + content.substr(i, 4);
  }
  console.log(formattedMessage);

  const persianText = formattedMessage.replace(/\\u([\d\w]{4})/gi, (match, grp) => {
    return String.fromCharCode(parseInt(grp, 16));
  });
  console.log(persianText);

  const bankRegex = /بلو\nواریز پول\n محمدحسین عزیز، ([\d,]+)/;

  const bankMatch = persianText.match(bankRegex);

  if (bankMatch) {
    let price = bankMatch[1];
    console.log(price);

    const { orders } = db.data
    let userId, messageId

    try {
      for (const orderId in orders.waiting) {
        const order = orders.waiting[orderId];
        if (order.amount == price) {
          [userId, messageId] = [order.user_id, order.message_id]
          delete order.message_id
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
          bot.sendMessage(userId, `✅ پرداخت شما برای سفارش ${orderId} با موفقیت تایید شد.\n\n😇 ابتدا بر روی لینک آپدیت زیر کلیک کرده تا کپی شود و سپس برای مشاهده نحوه اتصال، در منو اصلی ربات بر روی دکمه <b>«👨🏻‍🏫 آموزش اتصال»</b> کلیک کنید\n\n<code>${subLink}</code>`, { parse_mode: "HTML" });
          res.status(200).json({ msg: "verified", success: true });
          return
        }
      }
    } catch (err) {
      console.error("❌ Error: config_generation> ", err);
      bot.sendMessage(userId, "❌ متاسفانه مشکلی در تایید پرداخت یا ساخت کانفیگ به وجود آمده. لطفا به پشتیبانی پیام دهید 🙏");
    }
  } else {
    console.log('No match found.');
  }

  res.status(404).json({ msg: "transaction not found!", success: false });
});

const checkXuiSessionExpiration = () => {
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
  console.log(`Server listening on port ${port}`);
  await api.xui.login()
  cron.schedule('0 0 */25 * *', () => {
    checkXuiSessionExpiration()
  }).start();
  cron.schedule('*/1 * * * * *', () => {
    cleanExpiredCooldown()
    cleanExpiredOrders()
  }).start();
  cron.schedule('0 */24 * * *', () => {
    cleanExpiredConfigs()
  }).start();
  cleanExpiredConfigs()
});
