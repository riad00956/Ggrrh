const { Telegraf, Markup, session } = require('telegraf');
const BOT_TOKEN = process.env.BOT_TOKEN || '7685134552:AAH_qlJp65O9w7Vkzq74J_w6BmoJWguuWrY';
const bot = new Telegraf(BOT_TOKEN);

bot.use(session());

const warnings = {};

bot.start((ctx) => ctx.reply('👋 Welcome to the Admin Bot!\nUse /panel by replying to a user in group.'));

bot.command('panel', async (ctx) => {
    if (ctx.chat.type !== 'supergroup') return;
    const member = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
    if (!['administrator', 'creator'].includes(member.status)) return;

    ctx.reply('🔧 *Admin Panel*\nReply to a user message and tap an action:', {
        parse_mode: 'Markdown',
        ...Markup.inlineKeyboard([
            [Markup.button.callback('🚫 Ban', 'ban'), Markup.button.callback('👢 Kick', 'kick')],
            [Markup.button.callback('🔇 Mute', 'mute'), Markup.button.callback('🔊 Unmute', 'unmute')],
            [Markup.button.callback('⚠️ Warn', 'warn'), Markup.button.callback('📊 Stats', 'stats')],
        ])
    });
});

const actions = ['ban', 'kick', 'mute', 'unmute', 'warn', 'stats'];

actions.forEach(action => {
    bot.action(action, async (ctx) => {
        await ctx.answerCbQuery();
        ctx.session.lastAction = action;
        await ctx.editMessageText(`✅ Now reply to a user message to perform: *${action.toUpperCase()}*`, {
            parse_mode: 'Markdown'
        });
    });
});

bot.on('message', async (ctx) => {
    const reply = ctx.message.reply_to_message;
    if (!reply || !ctx.session || !ctx.session.lastAction) return;

    const action = ctx.session.lastAction;
    const targetId = reply.from.id;
    const chatId = ctx.chat.id;

    const sender = await ctx.telegram.getChatMember(chatId, ctx.from.id);
    if (!['administrator', 'creator'].includes(sender.status)) {
        return ctx.reply("🚫 Admins only!");
    }

    try {
        switch (action) {
            case 'ban':
                await ctx.telegram.kickChatMember(chatId, targetId);
                ctx.reply(`🚫 Banned ${reply.from.first_name}`);
                break;
            case 'kick':
                await ctx.telegram.unbanChatMember(chatId, targetId);
                ctx.reply(`👢 Kicked ${reply.from.first_name}`);
                break;
            case 'mute':
                await ctx.telegram.restrictChatMember(chatId, targetId, {
                    permissions: { can_send_messages: false }
                });
                ctx.reply(`🔇 Muted ${reply.from.first_name}`);
                break;
            case 'unmute':
                await ctx.telegram.restrictChatMember(chatId, targetId, {
                    permissions: {
                        can_send_messages: true,
                        can_send_media_messages: true,
                        can_send_other_messages: true,
                        can_add_web_page_previews: true
                    }
                });
                ctx.reply(`🔊 Unmuted ${reply.from.first_name}`);
                break;
            case 'warn':
                warnings[targetId] = (warnings[targetId] || 0) + 1;
                ctx.reply(`⚠️ Warned ${reply.from.first_name} (${warnings[targetId]}/3)`);
                if (warnings[targetId] >= 3) {
                    await ctx.telegram.kickChatMember(chatId, targetId);
                    ctx.reply(`🚫 Auto-banned ${reply.from.first_name} for 3 warnings.`);
                    warnings[targetId] = 0;
                }
                break;
            case 'stats':
                ctx.reply(`📊 ${reply.from.first_name} has ${warnings[targetId] || 0} warning(s).`);
                break;
        }

        ctx.session.lastAction = null;

    } catch (error) {
        ctx.reply(`❌ Error: ${error.description || error.message}`);
    }
});

// ✅ Port 8000 explicitly set (works with Render)
const PORT = process.env.PORT || 8000;

bot.launch({
    webhook: {
        domain: process.env.RENDER_EXTERNAL_HOSTNAME,
        port: PORT
    }
});

console.log("✅ Bot running on port:", PORT);
