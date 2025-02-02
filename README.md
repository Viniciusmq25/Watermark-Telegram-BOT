# Watermark Bot

A Telegram bot that adds text or image watermarks to photos and videos. The bot supports multiple watermark sizes and can handle both text and PNG image watermarks.

## Features

- Add text watermarks to photos and videos
- Add PNG image watermarks to photos and videos
- Three watermark size options: small, medium, and large
- File size limits for safe processing
- Automatic file cleanup after processing
- Support for custom fonts
- Error handling and user feedback

## Prerequisites

- Node.js installed on your system
- FFmpeg installed for video processing
- A Telegram Bot token (obtainable from [@BotFather](https://t.me/botfather))

## Installation

1. Clone the repository:
```bash
git clone https://github.com/Viniciusmq25/Watermark-BOT.git
cd watermark-BOT
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Add your bot token to `.env`:
```
BOT_TOKEN=your_telegram_bot_token_here
```

## Required Dependencies

```bash
npm install node-telegram-bot-api jimp fluent-ffmpeg dotenv
```

## Usage

1. Start the bot:
```bash
node main.js
```

2. In Telegram, interact with the bot using these commands:

- `/start` - start the bot
- `/size [small|medium|large]` - Set the watermark size
- Send any photo or video to apply the configured watermark

## File Size Limits

- Photos: 20MB
- Videos: 20MB

## Examples

1. Adding watermark:
   - Delete the example watermark 
   - Put a PNG file with the name "watermark.png"
   - Send a photo or video to the bot

## Technical Details

The bot uses:
- `node-telegram-bot-api` for Telegram interaction
- `Jimp` for image processing
- `fluent-ffmpeg` for video processing
- `dotenv` for environment variable management

## Error Handling

The bot includes comprehensive error handling for:
- File size limits
- Download timeouts
- Processing errors
- Invalid file types
- Output file size restrictions

### First Time Setup
1. Clone the repository
2. Create `.env` file from `.env.example`
3. Add your Telegram Bot Token to `.env`
4. Run `npm install`
5. Start the bot with `node main.js`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Author

Vinicius Quintian

## Acknowledgments

- Telegram Bot API
- Node.js community
- FFmpeg project
