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
import { v4 as uuidv4 } from 'uuid';

const iranTimezone = "Asia/Tehran";

const environment = process.env.NODE_ENV || "dev";
dotenv.config({
  path: `.env.${environment}`,
});

const __dirname = dirname(fileURLToPath(import.meta.url));
const file = join(__dirname, "./db.json");
const adapter = new JSONFileSync(file);
const defaultData = { users: [] };
const db = new LowSync(adapter, defaultData);
db.read();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const plans = [
  {
    id: 101,
    name: "🥇${TRAFFIC} گیگ - ${PERIOD} ماهه - 💳 ${PRICE} تومان",
    traffic: 100,
    period: 30,
    original_price: 229,
    final_price: 199,
    version: 1,
    active: true,
  },
  {
    id: 102,
    name: "🥇${TRAFFIC} گیگ - ${PERIOD} ماهه - 💳 ${PRICE} تومان",
    traffic: 200,
    period: 30,
    original_price: 419,
    final_price: 379,
    version: 1,
    active: true,
  },
];

const FIX_COMMISSION = 15;

const INBOUND = {
  id: 3,
  protocol: "vless",
  domain: "ir.torgod.site",
  port: 443,
  type: "ws",
  path: "%2F",
  security: 'tls',
  sni: "ir.torgod.site"
}
const LIMIT_IP = 5

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
  }
};

const vpn = {
  addConfig: async (userId, plan) => {
    const config = vpn.createConfigObj(userId, plan.traffic, plan.period)
    await api.xui.addClient(INBOUND.id, config)
    return { inbound_id: INBOUND.id, ...config }
  },
  addTestConfig: async (userId) => {
    const testConfig = vpn.createConfigObj(userId, 0.5, 1, true)
    await api.xui.addClient(INBOUND.id, testConfig)
    return { inbound_id: INBOUND.id, ...testConfig }
  },
  createConfigObj: (userId, traffic, period, isTest = false) => {
    const uuid = uuidv4()
    const nowtime = Date.now()
    return {
      alterId: 0,
      email: `${isTest ? "test-" : ""}${userId}-${nowtime}`,
      enable: true,
      expiryTime: nowtime + (period * 86400000),
      id: uuid,
      limitIp: LIMIT_IP,
      subId: "",
      tgId: "",
      totalGB: traffic * 1000000000
    }
  },
  linkGenerator: (id, orderId) => {
    const { protocol, domain, port, type, path, sni } = INBOUND
    return `${protocol}://${id}@${domain}:${port}?type=${type}&path=${path}&security=tls&fp=&alpn=&sni=${sni}#Dedicated%20VPN%20-%20${orderId}`
  }
}

let cooldowns = {};
const COOLDOWN_PERIOD = 1000;

const isOnCooldown = (userId) => {
  if (cooldowns[userId] && cooldowns[userId] > Date.now())
    return true;
  cooldowns[userId] = Date.now() + COOLDOWN_PERIOD;
  return false;
}

const cleanExpiredCooldown = () => {
  const cooldownUsers = Object.getOwnPropertyNames(cooldowns)
  cooldownUsers.map((cooldownUserId) => {
    if (cooldowns[cooldownUserId] < Date.now())
      delete cooldowns[cooldownUserId]
  })
}

const cleanExpiredOrders = async () => {
  try {
    const { orders } = db.data
    let userId, messageId
    for (const orderId in orders.waiting) {
      const order = orders.waiting[orderId];
      if (order.limit_time < Date.now()) {
        [userId, messageId] = [order.user_id, order.message_id]
        delete order.message_id
        orders.expired[order.id] = { ...order }
        delete orders.waiting[orderId]
        bot.deleteMessage(userId, messageId);
        bot.sendMessage(userId, `❌ زمان انجام تراکنش برای سفارش ${orderId} به اتمام رسید.\n🙏 لطفا با زدن دکمه <b>«🚀 خرید سرویس VPN»</b> از منوی اصلی اقدام به ثبت سفارش جدید بفرمایید.`, { parse_mode: "HTML" })
        db.write()
      }
    }
  } catch (err) {
    console.error("❌ Error: config_generation> ", err);
    bot.sendMessage(userId, "❌ متاسفانه مشکلی در تایید پرداخت یا ساخت کانفیگ به وجود آمده. لطفا به پشتیبانی پیام دهید 🙏");
  }
}

const convertTimestampToIran = (time) => {
  let iranTime = new Date(time);
  iranTime = moment(iranTime.toISOString())
    .tz(iranTimezone)
    .format()
    .replace("T", " ")
    .replace(/-/g, '/')
    .slice(0, 19)
  return iranTime
}

bot.onText(/\/start/, ({ from }) => {
  if (isOnCooldown(from.id)) return
  if (from.is_bot)
    return;

  const user = db.data.users[from.id];
  if (!user) {
    db.data.users[from.id] = {
      id: from.id,
      tg_name: from.first_name,
      tg_username: from.username,
      test_config: null,
      configs: [],
      created_at: convertTimestampToIran(Date.now()),
    }
    db.write();
  }
  bot.sendMessage(from.id, "توضیحات کوتاه روبات", {
    reply_markup: JSON.stringify({
      keyboard: [
        ["🎁 دریافت تست رایگان", "🚀 خرید سرویس VPN"],
        ["🛒 کانفیگ های من", "👨🏼‍🏫 آموزش اتصال"],
        ["😇 پشتیبانی (فنی و مالی)"],
      ],
      resize_keyboard: true,
    }),
  });
});

bot.onText(/🎁 دریافت تست رایگان/, async ({ from }) => {
  if (isOnCooldown(from.id)) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "❌ متاسفانه مشکلی پیش آمده.\n لطفا بر روی /start بزنید.");
    return
  }
  if (user.test_config) {
    bot.sendMessage(
      from.id,
      "❌ امکان دریافت کانفیگ تست برای شما مقدور نیست. (شما قبلا کانفیگ تست را دریافت نموده‌ای)"
    );
    return;
  }
  try {
    const testConfig = await vpn.addTestConfig(user.id)
    const textConfig = vpn.linkGenerator(testConfig.id, 'test')
    user.test_config = testConfig
    db.write()
    bot.sendMessage(from.id, `✅ کانفیگ شما با موفقیت ایجاد شد.\n\n😇 ابتدا بر روی کانفیگ زیر کلیک کرده تا کپی شود و سپس برای مشاهده نحوه اتصال، در منو اصلی ربات بر روی دکمه <b>👨🏼‍🏫 آموزش اتصال 👨🏼‍🏫</b> کلیک کنید\n\n<code>${textConfig}</code>`, { parse_mode: "HTML" });
  } catch (e) {
    console.error("❌ Error: test_config_generation> ", e);
    bot.sendMessage(from.id, "❌ مشکلی در ساخت کافیگ تست رخ داده است. لطفا دوباره تلاش کنید 🙏");
  }
});

bot.onText(/🚀 خرید سرویس VPN/, ({ from }) => {
  if (isOnCooldown(from.id)) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "❌ متاسفانه مشکلی پیش آمده.\n لطفا بر روی /start بزنید.");
    return
  }
  bot.sendMessage(from.id, "🔻 قوانین و مقررات", {
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

bot.onText(/🛒 کانفیگ های من/, async ({ from }) => {
  if (isOnCooldown(from.id)) return
  const user = db.data.users[from.id]
  if (!user) {
    bot.sendMessage(from.id, "❌ متاسفانه مشکلی پیش آمده.\n لطفا بر روی /start بزنید.");
    return
  }
  if (user.configs.length == 0) {
    bot.sendMessage(from.id, "⚠️ شما درحال حاضر هیچ کانفیگ خریداری شده ای ندارید.\n\n🙏 لطفا با زدن دکمه خرید سرویس از منو اصلی اقدام به خرید کانفیگ کنید.");
    return
  }
  let botMsg = ""
  user.configs.map(({ id, orderId }) => {
    const textConfig = vpn.linkGenerator(id, orderId)
    botMsg = botMsg + `\n\n🌈 سفارش: ${orderId}\n\n<code>${textConfig}</code>\n---------------------------------`
  })
  bot.sendMessage(from.id, botMsg, { parse_mode: "HTML" });
});

bot.onText(/👨🏼‍🏫 آموزش اتصال/, async ({ from }) => {

});

bot.onText(/😇 پشتیبانی/, ({ from }) => {
  if (isOnCooldown(from.id)) return
  const botMsg =
    "⚠️درصورتی که تنها مشکل در پرداخت و یا خرید داشتین به آی دی زیر پیام دهید.\n⚠️درصورتی که تمامی آموزش ها را مشاهده کرده اید و همچنان در اتصال مشکل دارید میتوانید به آی دی زیر پیام دهید.\n@dedicated_vpn_support";
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
    bot.editMessageText("⏳ در حال صدور فاکتور ...\n🙏 لطفا منتظر بمانید", {
      chat_id: chatId,
      message_id: messageId,
    });
    const plan = plans.find((item) => item.id == queryData.data.planId);
    try {
      const orderId = Math.floor(Math.random() * (999999999 - 100000000 + 1)) + 100000000;
      const code = Math.floor(Math.random() * (9999 - 1000 + 1)) + 1000
      let amount = (plan.final_price * 10000) + code
      amount = amount.toLocaleString()
      const now = Date.now()
      const expireAt = now + 7200000 // 2 hours

      const order = {
        id: orderId,
        user_id: from.id,
        message_id: messageId,
        plan: {
          ...plan,
          name: plan.name
            .replace("${TRAFFIC}", plan.traffic)
            .replace("${PERIOD}", plan.period / 30)
            .replace("${PRICE}", plan.final_price),
        },
        amount,
        created_at: convertTimestampToIran(now),
        expire_at: convertTimestampToIran(expireAt),
        limit_time: expireAt
      };
      db.data.orders.waiting[orderId] = order;
      db.write();

      //--> enter card number for transaction
      bot.editMessageText(
        `#️⃣ شماره سفارش: ${orderId}\n\n🟡 آخرین وضعیت: <b>درانتظار پرداخت</b>\n\n⬇️ قبل از باز کردن <b>«💸 لینک خرید»</b> باید <b>VPN</b> خود را <b>خاموش</b> کنید\n\n✅ ۵ دقیقه پس از پرداخت موفق، <b>«🕵🏻‍♂️ بررسی پرداخت»</b> را بزنید تا اشتراک فعال شود\n\n⚠️ <b>هشدار: لینک پرداخت تنها تا ساعت ${convertTimestampToIran(expireAt).slice(11, 16)} اعتبار دارد و پس از آن هیچ مسئولیتی بر عهده ما نخواهد بود.</b>`,
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

    const botMsg = `🥇 ${plan.traffic} گیگ   ⏰ ${plan.period / 30
      } ماهه\n🌟 چند کاربره (بدون محدودیت اتصال)\n💳 ${plan.original_price
      } تومان: با تخفیف ⬅️ ${plan.final_price
      } تومان\n\n برای صدور فاکتور و خرید نهایی روی دکمه "صدور فاکتور ✅" کلیک کنید.`;

    bot.editMessageText(botMsg, {
      chat_id: chatId,
      message_id: messageId,
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
      "🔻 لطفا یک طرح را انتخاب کنید: لطفا یک طرح را انتخاب کنید:";
    bot.editMessageText(botMsg, {
      chat_id: chatId,
      message_id: messageId,
      reply_markup: {
        inline_keyboard: plans.map((item) => {
          return [
            {
              text: item.name
                .replace("${TRAFFIC}", item.traffic)
                .replace("${PERIOD}", item.period / 30)
                .replace("${PRICE}", item.final_price),
              callback_data: JSON.stringify({
                action: "plan_detailes",
                data: { planId: item.id },
              }),
            },
          ];
        }),
      },
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
  const { amount } = req.body
  const { orders } = db.data
  let userId, messageId
  console.log(req.body);

  try {
    for (const orderId in orders.waiting) {
      const order = orders.waiting[orderId];
      if (order.amount == amount) {
        [userId, messageId] = [order.user_id, order.message_id]
        delete order.message_id
        orders.verified[order.id] = { ...order, paid_at: convertTimestampToIran(Date.now()) }
        delete orders.waiting[orderId]
        bot.editMessageText(`✅ سفارش ${orderId} با موفقیت پرداخت شد\n👨🏻‍💻 درحال ساخت کانفیگ...`, {
          chat_id: userId,
          message_id: messageId,
        });

        const config = await vpn.addConfig(userId, order.plan)
        db.data.users[userId].configs.push({
          ...config,
          orderId: order.id
        })
        db.write()
        const textConfig = vpn.linkGenerator(config.id, order.id)
        bot.sendMessage(userId, `✅ کانفیگ شما با موفقیت ایجاد شد.\n\n😇 ابتدا بر روی کانفیگ زیر کلیک کرده تا کپی شود و سپس برای مشاهده نحوه اتصال، در منو اصلی ربات بر روی دکمه <b>👨🏼‍🏫 آموزش اتصال 👨🏼‍🏫</b> کلیک کنید\n\n<code>${textConfig}</code>`, { parse_mode: "HTML" });
        res.status(200).json({ msg: "verified", success: true });
        return
      }
    }
  } catch (err) {
    console.error("❌ Error: config_generation> ", err);
    bot.sendMessage(userId, "❌ متاسفانه مشکلی در تایید پرداخت یا ساخت کانفیگ به وجود آمده. لطفا به پشتیبانی پیام دهید 🙏");
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

const port = process.env.PORT || 80;
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
});
