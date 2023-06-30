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

const INBOUND = {
  id: 4,
  protocol: "vless",
  domain: "ir.torgod.site",
  port: 443,
  type: "ws",
  path: "%2F",
  security: 'none',
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
            reject(`API call error [xui/addClient]: ${error}`);
          });
      });
    }
  }
};

const vpn = {
  addConfig: async (userId, orderId, plan) => {
    const config = vpn.createConfigObj(userId, orderId, plan.traffic, plan.period)
    await api.xui.addClient(INBOUND.id, config)
    return { inbound_id: INBOUND.id, ...config }
  },
  addTestConfig: async (userId) => {
    const testConfig = vpn.createConfigObj(userId, null, 0.5, 1, true)
    await api.xui.addClient(INBOUND.id, testConfig)
    return { inbound_id: INBOUND.id, ...testConfig }
  },
  createConfigObj: (userId, orderId, traffic, period, isTest = false) => {
    const uuid = uuidv4()
    const nowtime = Date.now()
    return {
      alterId: 0,
      email: `${userId}-${isTest ? "test" : orderId}🚀`,
      enable: true,
      expiryTime: nowtime + (period * 86400000),
      id: uuid,
      limitIp: LIMIT_IP,
      subId: isTest ? `test-${userId}` : orderId,
      tgId: "",
      totalGB: traffic * 1000000000
    }
  },
  getSubLink: (subId) => {
    return `https://ir.torgod.site:2096/sub/${subId}`
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
        bot.sendMessage(userId, `❌ زمان انجام تراکنش برای سفارش ${orderId} به اتمام رسید.\n\n✅ درصورتی که هزینه سرویس را به درستی به کارت مقصد ارسال نمودین  اما به صورت خودکار از سمت ما تایید نشده، لطفا رسید پرداخت را برای پشتیبانی ارسال بفرمایید. \nدر غیر این صورت لطفا با زدن دکمه «🚀 خرید سرویس VPN» از منوی اصلی اقدام به ثبت و پرداخت سفارش جدید بفرمایید.`, { parse_mode: "HTML" })
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
  bot.sendMessage(from.id, "😇 به بات فروش سرویس VPN اختصاصی خوش آمدید\n\n😋 برای دریافت تست رایگان ۲۴ ساعته، روی دکمه «🎁 دریافت تست رایگان» در منو اصلی بزنید تا کانفیگ تست را دریافت نمایید (۵۰۰ مگابایت)", {
    reply_markup: JSON.stringify({
      keyboard: [
        ["🎁 دریافت تست رایگان", "🚀 خرید سرویس VPN"],
        ["🛒 سفارشات من", "👨🏼‍🏫 آموزش اتصال"],
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
    const subLink = vpn.getSubLink(testConfig.subId)
    user.test_config = testConfig
    db.write()
    bot.sendMessage(from.id, `"✅ کانفیگ تست با موفقیت ساخته شده.\n\n⚠️ این کانفیگ شامل ۵۰۰ مگابایت حجم رایگان بوده و تنها ۲۴ ساعت اعتبار دارد.\n\n📡 از کانفیگ تست میتوانید برای بررسی ارتباط، سرعت و پایداری سرویس با اوپراتور خود استفاده کنید.\n\n🌈 بر روی لینک آپدیت زیر کلیک کرده تا کپی شود و از طریق دکمه «👨🏻‍🏫 آموزش اتصال» در منو اصلی به کانفیگ زیر متصل شوید."\n\n<code>${subLink}</code>`, { parse_mode: "HTML" });
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
  bot.sendMessage(
    from.id,
    "🔻 شرایط و قوانین استفاده از سرویس:\n\n۱) 🌟حتما قبل از خرید سرویس، از منو اصلی بات، کانفیگ تست را دریافت نموده تا از توانایی اتصال به سرویس های ما با استفاده از اوپراتور خودتان مطمئن شوید. (در غیر این صورت مسئولیت خرید بر عهده کاربر است)\n\n۲) 📡  سرویس ما در تمام ساعات روز برای شما عزیزان قابل دسترس است مگر اینکه اختلال کلی در زیرساخت کشور وجود داشته باشد که در این صورت باید صبر کنید تا اختلال های زیرساخت کشور برطرف شود.\n\n۳) 🕵🏻‍♂️ خرید سرویس از طریق کارت به کارت صورت میگیرد و از تکنولوژی تایید خودکار تراکنش استفاده میشود (به این صورت که پس از دریافت تراکنش از سمت شما به کارت مقصد، کانفیگ ها به صورت خودکار ساخته و تحویل داده میشود. (اما کاربر همچنان موظف به ذخیره رسید کارت به کارت برای مواقع خاص میباشد)\n\n۴) ❌ کاربران حق فروش و یا اجاره سرویس به افراد دیگر را نداشته و باید حتما سرویس را از بات تهیه کنند.\n\n😇 ایا شرایط را می پذیرید؟",
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
  try {
    for (const { email, subId, orderId } of user.configs) {
      const { up, down, total } = await api.xui.getClientInfo(email)
      const { paid_at, expire_at } = db.data.orders.verified[orderId]
      const subLink = vpn.getSubLink(subId)
      const remainingTraffic = ((total - up - down) / 1000000000).toFixed(2)
      botMsg = `\n\n\n🌈 شماره سفارش: ${orderId}\n🥇 حجم باقیمانده: ${remainingTraffic} گیگ\n⏱️ زمان تحویل: ${paid_at.slice(0, 16)}\n📅 زمان انقضا: ${expire_at.slice(0, 16)}\n♻️لینک اپدیت: \n<code>${subLink}</code>` + botMsg
    }
    bot.sendMessage(from.id, botMsg, { parse_mode: "HTML" });
  } catch (err) {
    bot.sendMessage(from.id, "❌ متاسفانه مشکلی در دریافت سفارشات شما بوجود آمده است.\n🙏 لطفا پس از چند دقیقه دوباره تلاش کنید.");
  }
});

bot.onText(/👨🏼‍🏫 آموزش اتصال/, async ({ from }) => {

});

bot.onText(/😇 پشتیبانی/, ({ from }) => {
  if (isOnCooldown(from.id)) return
  const botMsg =
    "😇🙏🏻 قبل از ارتباط با پشتیبانی لطف کنید و ابتدا در گروه سوال خود را مطرح کنید و درصورتی که مشکلتان حل نشد ،حتما آموزش های نحوه اتصال به سرویس را از طریق منو اصلی بات دریافت و مشاهده بفرمایید.\n\n🔗 لینک گروه: \n@dedicated_vpn_group\n\n💸 درصورتی که مبلغ دقیق سرویس را با موفقیت به کارت مقصد ارسال کردین ولی کانفیگ را پس از گذشت حداکثر ۱۵ دقیقه دریافت نکردین، میتوانید به پشتیبانی پیام داده و رسید خود را ارسال بفرمایید تا در اسرع وقت بررسی شود.\n\n🫂 پشتیبانی مالی و فنی: @dedicated_vpn_support";
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
        `🌟 جهت پرداخت هزینه سرویس مبلغ دقیق زیر را به شماره کارت ذکر شده حداکثر تا ساعت ${convertTimestampToIran(expireAt).slice(11, 16)} ارسال بفرمایید.\n\n💳 شماره کارت: 6219-8619-0430-8318\n\n👤 صاحب حساب: محمد حسین مویدی\n\n💸 مبلغ نهایی: ${amount} ریال (بر روی عدد مبلغ بزنید تا کپی شود)\n\n❌ توجه: تمامی اعداد مبلغ نهایی سرویس جهت تایید خودکار تراکنش بسیار مهم بوده و باید با دقت وارد شود\n\n✅  بین ۱ تا ۵ دقیقه پس از پرداخت موفق، سفارش شما به صورت خودکار و آنی تحویل داده میشود. (درصورت عدم دریافت سفارش، لطفا به پشتیبانی مراجعه فرمایید)\n\n🌈 شماره سفارش: ${orderId}\n\n🟡 آخرین وضعیت: درانتظار پرداخت`,
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

    const botMsg = `🥇 ${plan.traffic} گیگ   ⏰ ${plan.period / 30} ماهه\n🌟 چند کاربره (بدون محدودیت اتصال)\n💳 ${plan.original_price} تومان ⬅️ ${plan.final_price} تومان 🎉\n\nبرای صدور فاکتور و خرید نهایی روی دکمه \"صدور فاکتور ✅\" کلیک کنید.`

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
      "🌟 توجه: تمامی پلن ها <b>چندکاربره</b> هستند 🌟\n🔻 لطفا طرح مورد نظر خود را انتخاب کنید 🔻";
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
        bot.deleteMessage(userId, messageId);

        const config = await vpn.addConfig(userId, orderId, order.plan)
        db.data.users[userId].configs.push({
          ...config,
          orderId: order.id
        })
        db.write()
        const subLink = vpn.getSubLink(config.subId)
        bot.sendMessage(userId, `✅ پرداخت شما برای سفارش ${orderId} با موفقیت تایید شد.\n\n😇 ابتدا بر روی لینک آپدیت زیر کلیک کرده تا کپی شود و سپس برای مشاهده نحوه اتصال، در منو اصلی ربات بر روی دکمه <b>👨🏼‍🏫 آموزش اتصال 👨🏼‍🏫</b> کلیک کنید\n\n<code>${subLink}</code>`, { parse_mode: "HTML" });
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
