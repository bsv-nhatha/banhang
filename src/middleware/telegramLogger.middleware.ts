import { Request, Response, NextFunction } from 'express';
import telegramService from '../services/telegram.service';

const telegramLoggerMiddleware = async (err: any, req: Request, res: Response, next: NextFunction) => {
    try {
        const errorTime = new Date().toLocaleString('vi-VN');
        const method = req.method;
        const url = req.originalUrl;
        const ip = req.ip || req.socket.remoteAddress;
        const userAgent = req.get('User-Agent') || 'Unknown';

        // Format headers specifically as requested
        const headers = JSON.stringify(req.headers, null, 2);
        // Format body
        const body = JSON.stringify(req.body, null, 2);
        // Format query params
        const query = JSON.stringify(req.query, null, 2);

        const message = `
🚨 <b>EXCEPTION ALERT</b> 🚨
--------------------------------
<b>Time:</b> ${errorTime}
<b>Method:</b> ${method}
<b>URL:</b> ${url}
<b>IP:</b> ${ip}
<b>User Agent:</b> ${userAgent}
--------------------------------
<b>Error:</b>
<pre>${err.message}</pre>
<b>Stack:</b>
<pre>${err.stack ? err.stack.substring(0, 500) : 'No stack trace'}</pre>
--------------------------------
<b>Headers:</b>
<pre>${headers}</pre>
<b>Body:</b>
<pre>${body}</pre>
<b>Query:</b>
<pre>${query}</pre>
    `;

        // Send to Telegram asynchronously (fire and forget to not block response)
        telegramService.sendMessage(message).catch(console.error);

    } catch (loggerError) {
        console.error('Error in telegramLoggerMiddleware:', loggerError);
    }

    // Pass the error to the next error handler
    next(err);
};

export default telegramLoggerMiddleware;
