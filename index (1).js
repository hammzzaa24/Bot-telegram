const { Telegraf, Markup } = require('telegraf');
const Binance = require('node-binance-api');
require('dotenv').config();

// إعداد التوكن الخاص بالبوت
const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
    console.error("❌ لم يتم العثور على توكن البوت. تحقق من ملف .env.");
    process.exit(1);
}

// إعداد Binance API
const binance = new Binance().options({
    APIKEY: process.env.BINANCE_API_KEY,
    APISECRET: process.env.BINANCE_SECRET_KEY,
});

// إنشاء البوت
const bot = new Telegraf(BOT_TOKEN);

bot.on('text', async (ctx) => {
    try {
        const message = ctx.message.text;

        // استخراج زوج التداول
        const pairMatch = message.match(/#(\w+)/);
        if (!pairMatch) {
            ctx.reply('❌ لا يمكن التعرف على زوج التداول.');
            return;
        }

        const pair = pairMatch[1]; // زوج التداول
        const symbol = pair.replace("USDT", "/USDT"); // تحويل صيغة الزوج لـ Binance
        const isHalal = message.includes('✅ Halal');
        const btcUp = message.includes('🟢 BTC is UP');
        const liquidityMatch = message.match(/Liquidity\s*:\s*\$\$([\d,]+)/);
        const targetMatch = message.match(/🎯 1% Target: ([\d.]+)/);

        let liquidity = 0;
        if (liquidityMatch) {
            liquidity = parseInt(liquidityMatch[1].replace(/,/g, ''));
        }

        if (!targetMatch) {
            ctx.reply('❌ لا يمكن العثور على هدف البيع.');
            return;
        }

        const targetPrice = parseFloat(targetMatch[1]);

        // التحقق من الشروط
        if (isHalal && btcUp && liquidity > 100000) {
            ctx.reply(
                `الشروط مستوفاة 🎯✅✅ لـ  ${pair}. اختر المبلغ للاستثمار:`,
                Markup.inlineKeyboard([
                    Markup.button.callback('💰 استثمار 10$', `invest_10_${pair}_${targetPrice}`),
                    Markup.button.callback('💰 استثمار 20$', `invest_20_${pair}_${targetPrice}`),
                ])
            );
        } else {
            ctx.reply('❌❌⛔ الشروط غير مستوفاة لهذه الصفقة.');
        }
    } catch (error) {
        console.error("❌❌ خطأ أثناء تحليل الرسالة:", error);
        ctx.reply('❌ حدث خطأ أثناء تحليل الرسالة.');
    }
});

// التعامل مع ضغطات الأزرار
bot.on('callback_query', async (ctx) => {
    try {
        const data = ctx.callbackQuery.data;
        if (data.startsWith('invest')) {
            const parts = data.split('_');
            const amount = parseFloat(parts[1]); // المبلغ
            const pair = parts[2]; // الزوج
            const targetPrice = parseFloat(parts[3]); // الهدف

            // شراء العملة
            const symbol = pair.replace("USDT", "USDT"); // صيغة الزوج لـ Binance
            const quantity = (amount / targetPrice).toFixed(6); // كمية العملة المطلوبة

            ctx.reply(`🔄 يتم شراء ${quantity} من ${pair} بقيمة ${amount}$...`);

            // تنفيذ أمر الشراء
            const order = await binance.marketBuy(pair, quantity);

            ctx.reply(`✅ تم شراء ${quantity} من ${pair} بنجاح. سيتم وضع أمر بيع عند ${targetPrice} USDT.`);

            // وضع أمر البيع
            await binance.sell(pair, quantity, targetPrice);

            ctx.reply(`📊 تم وضع أمر البيع عند ${targetPrice} USDT.`);
        }
    } catch (error) {
        console.error("❌ خطأ أثناء معالجة الطلب:", error);
        ctx.reply('❌ حدث خطأ أثناء تنفيذ العملية. تحقق من إعدادات Binance.');
    }
});

// تشغيل البوت
bot.launch()
    .then(() => console.log('🚀 البوت يعمل الآن!'))
    .catch((err) => console.error('❌ خطأ في تشغيل البوت:', err));

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
