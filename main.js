const TelegramBot = require('node-telegram-bot-api');
const Jimp = require('jimp');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

// Verifica se o token está definido
if (!process.env.BOT_TOKEN) {
    console.error('BOT_TOKEN não encontrado no arquivo .env');
    process.exit(1);
}

// Configurações de limite de tamanho (em bytes)
const FILE_SIZE_LIMITS = {
    PHOTO: 20 * 2024 * 2024, // 5MB para fotos
    VIDEO: 20 * 2024 * 2024 // 20MB para vídeos
};

// Configurações do bot
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

// Armazena o tamanho da marca d'água para cada usuário
const userWatermarkSizes = {};

// Caminho da marca d'água fixa
const WATERMARK_PATH = './watermark.png';

// Função para verificar o tamanho do arquivo antes de baixar
async function checkFileSize(fileId) {
    try {
        const file = await bot.getFile(fileId);
        return {
            size: file.file_size,
            path: file.file_path
        };
    } catch (error) {
        console.error('Erro ao verificar tamanho do arquivo:', error);
        throw error;
    }
}

// Função para download
function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        let timeoutId;

        const request = https.get(url, (response) => {
            if (response.statusCode !== 200) {
                reject(new Error(`Failed to download: ${response.statusCode}`));
                return;
            }

            response.pipe(file);

            file.on('finish', () => {
                clearTimeout(timeoutId);
                file.close(() => resolve(dest));
            });
        });

        timeoutId = setTimeout(() => {
            request.abort();
            file.close();
            fs.unlink(dest, () => {});
            reject(new Error('Download timeout'));
        }, 3000000);// 5 min

        request.on('error', (err) => {
            clearTimeout(timeoutId);
            file.close();
            fs.unlink(dest, () => {});
            reject(err);
        });

        file.on('error', (err) => {
            clearTimeout(timeoutId);
            file.close();
            fs.unlink(dest, () => {});
            reject(err);
        });
    });
}

// Função para adicionar marca d'água em imagens
async function addImageWatermarkToImage(imagePath, size, outputPath) {
    try {
        const image = await Jimp.read(imagePath);
        const watermark = await Jimp.read(WATERMARK_PATH);

        const scaleFactor = size === 'large' ? 0.5 : (size === 'medium' ? 0.25 : 0.1);
        watermark.resize(image.bitmap.width * scaleFactor, Jimp.AUTO);

        const x = 10;
        const y = 10;

        image.composite(watermark, x, y, {
            mode: Jimp.BLEND_SOURCE_OVER,
            opacitySource: 0.75
        });

        await image.writeAsync(outputPath);
    } catch (error) {
        console.error('Erro ao adicionar marca d\'água:', error);
        throw error;
    }
}

// Função para adicionar marca d'água em vídeos
function addImageWatermarkToVideo(videoPath, outputPath) {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(videoPath, (err, metadata) => {
            if (err) {
                console.error('Erro ao obter metadados do vídeo:', err);
                return reject(err);
            }

            const { width } = metadata.streams.find(s => s.codec_type === 'video');
            const scaleFactor = 0.5; // Escala da marca d'água em relação ao vídeo
            const watermarkFilter = `scale=${Math.round(width * scaleFactor)}:-1`;

            ffmpeg(videoPath)
                .input(WATERMARK_PATH)
                .complexFilter([
                    `[1:v]${watermarkFilter}[wm];[0:v][wm]overlay=10:10`
                ])
                .on('end', resolve)
                .on('error', reject)
                .save(outputPath);
        });
    });
}

// Função para limpar arquivos
function cleanUpFiles(files) {
    files.forEach(file => {
        if (file && fs.existsSync(file)) {
            fs.unlink(file, (err) => {
                if (err) console.error(`Erro ao apagar o arquivo ${file}:`, err);
            });
        }
    });
}

//comando /start
bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, 'Hello! I am a watermark bot. Send me a photo or video to add a watermark to it. Use /size <b>large</b>, <b>medium</b> or <b>small</b> to adjust the size.', { parse_mode: 'HTML' });
});

// Comando /size
bot.onText(/\/size (small|medium|large)/, (msg, match) => {
    const chatId = msg.chat.id;
    const size = match[1];
    userWatermarkSizes[chatId] = size;
    bot.sendMessage(chatId, `Tamanho da marca d'água definido como ${size}. Envie uma foto ou vídeo para aplicar.`);
});

// Manipulador de mensagens para fotos e vídeos
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;

    if (msg.photo) {
        await handlePhoto(msg);
    } else if (msg.video) {
        await handleVideo(msg);
    } else if (msg.text && !msg.text.startsWith('/')) {
        await bot.sendMessage(chatId, 'Send a photo or video to add the watermark. Use /size <b>large</b>, <b>medium</b> or <b>small</b> to adjust the size.', { parse_mode: 'HTML' });
    }
});

// Função para processar fotos
async function handlePhoto(msg) {
  const chatId = msg.chat.id;
  const photo = msg.photo[msg.photo.length - 1];
  const fileId = photo.file_id;
  let imagePath, outputPath;
  let statusMessage;

  try {
      const fileInfo = await checkFileSize(fileId);
      if (fileInfo.size > FILE_SIZE_LIMITS.PHOTO) {
          throw new Error('FILE_TOO_LARGE');
      }

      const size = userWatermarkSizes[chatId] || 'large';
      
      statusMessage = await bot.sendMessage(chatId, '⏳ Downloading image...');
      
      const filePath = `https://api.telegram.org/file/bot${token}/${fileInfo.path}`;
      imagePath = `./downloads/${fileId}.jpg`;
      outputPath = `./downloads/watermarked_${fileId}.jpg`;

      await downloadFile(filePath, imagePath);
      
      await bot.editMessageText('⚙️ Adding watermark...', {
          chat_id: chatId,
          message_id: statusMessage.message_id
      });

      await addImageWatermarkToImage(imagePath, size, outputPath);

      await bot.deleteMessage(chatId, statusMessage.message_id);

      await bot.sendPhoto(chatId, outputPath, {
          caption: 'Here is your photo with watermark! Use /size <b>large</b>, <b>medium</b> or <b>small</b> to adjust the size.',
          parse_mode: 'HTML'
      });

  } catch (error) {
      let errorMessage = '❌ An error occurred while processing your image. Please try again.';
      
      if (error.message === 'FILE_TOO_LARGE') {
          errorMessage = `❌ The image is too large. Please send an image smaller than ${FILE_SIZE_LIMITS.PHOTO / (1024 * 1024)}MB.`;
      }
      
      if (statusMessage) {
          await bot.deleteMessage(chatId, statusMessage.message_id);
      }
      await bot.sendMessage(chatId, errorMessage);
      console.error('Error on photo processing:', error);
  } finally {
      cleanUpFiles([imagePath, outputPath].filter(f => f && fs.existsSync(f)));
  }
}

// Função para processar vídeos
async function handleVideo(msg) {
  const chatId = msg.chat.id;
  const video = msg.video;
  const fileId = video.file_id;
  let videoPath, outputPath;
  let statusMessage;

  try {
      const fileInfo = await checkFileSize(fileId);
      if (fileInfo.size > FILE_SIZE_LIMITS.VIDEO) {
          throw new Error('FILE_TOO_LARGE');
      }
      
      statusMessage = await bot.sendMessage(chatId, '⏳ Downloading video...');
      
      const filePath = `https://api.telegram.org/file/bot${token}/${fileInfo.path}`;
      videoPath = `./downloads/${fileId}.mp4`;
      outputPath = `./downloads/watermarked_${fileId}.mp4`;

      await downloadFile(filePath, videoPath);
      
      await bot.editMessageText('⚙️ Adding watermark', {
          chat_id: chatId,
          message_id: statusMessage.message_id
      });

      await addImageWatermarkToVideo(videoPath, outputPath);

      const stats = fs.statSync(outputPath);
      if (stats.size > FILE_SIZE_LIMITS.VIDEO) {
          throw new Error('OUTPUT_TOO_LARGE');
      }

      await bot.deleteMessage(chatId, statusMessage.message_id);

      await bot.sendVideo(chatId, outputPath, {
          caption: 'Here is your video with watermark! Use /size <b>large</b>, <b>medium</b> or <b>small</b> to adjust the size.',
          parse_mode: 'HTML'
      });

  } catch (error) {
      let errorMessage = '❌ An error occurred while processing your video. Please try again.';
      
      if (error.message === 'FILE_TOO_LARGE') {
          errorMessage = `❌ The video is too large. Please send an video smaller than ${FILE_SIZE_LIMITS.PHOTO / (1024 * 1024)}MB.`;
      } else if (error.message === 'OUTPUT_TOO_LARGE') {
          errorMessage = '❌ The processed video is too large to send. Try a smaller video.';
      }
      
      if (statusMessage) {
          await bot.deleteMessage(chatId, statusMessage.message_id);
      }
      await bot.sendMessage(chatId, errorMessage);
      console.error('Error on video processing', error);
  } finally {
      cleanUpFiles([videoPath, outputPath].filter(f => f && fs.existsSync(f)));
  }
}

// Criar pasta downloads se não existir
if (!fs.existsSync('./downloads')) {
    fs.mkdirSync('./downloads');
}

// Verificar se o arquivo watermark.png existe
if (!fs.existsSync(WATERMARK_PATH)) {
    console.error('The watermark.png file was not found! Please add the watermark.png file to the project root folder.');
    process.exit(1);
}

console.log('Bot is running...');