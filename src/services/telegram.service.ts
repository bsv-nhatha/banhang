import 'dotenv/config';

class TelegramService {
    private botToken: string;
    private chatId: string;

    constructor() {
        this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
        this.chatId = process.env.TELEGRAM_CHAT_ID || '';
    }

    public async sendMessage(message: string): Promise<void> {
        if (!this.botToken || !this.chatId) {
            console.warn('Telegram Bot Token or Chat ID is missing. Skipping notification.');
            return;
        }

        try {
            const url = `https://api.telegram.org/bot${this.botToken}/sendMessage`;
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    chat_id: this.chatId,
                    text: message,
                    parse_mode: 'HTML', // Or 'MarkdownV2'
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error('Failed to send Telegram message:', errorData);
            }
        } catch (error) {
            console.error('Error sending Telegram message:', error);
        }
    }
}

export default new TelegramService();
