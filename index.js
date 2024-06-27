const express = require('express');
const { GoogleGenerativeAI } = require("@google/generative-ai");
require('dotenv').config();

const app = express();

app.use(express.json());

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE');
  next();
});

const botToken = process.env.TELEGRAM_BOT_TOKEN;
const chatId = process.env.TELEGRAM_CHAT_ID;

const createTelegramPoll = async (botToken, chatId, question, options, correctOptionId) => {
  const url = `https://api.telegram.org/bot${botToken}/sendPoll`;
  const formData = new URLSearchParams();
  formData.append('chat_id', chatId);
  formData.append('question', question);
  formData.append('options', JSON.stringify(options));
  formData.append('correct_option_id', Number(correctOptionId));
  try {
    const response = await fetch(url, {
      method: 'POST',
      body: formData
    });
    const data = await response.json();
    console.log(data);
  } catch ( error ) {
    console.error(error);
  }
};

const generateQuestionAndOptions = async () => {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: 'gemini-1.0-pro' });
  const prompt = `
  Génère une question de sondage sur la programmation informatique avec des options de réponses.
  
  Les langages seront PHP, JavaScript et TypeScript.
  
  Ta réponse doit être uniquement comme suit :
  
  {
    "question": question,
    "options": ["answer1", "answer2"],
    "correctOptionId": The index of the correct answer in the options array.
  }
  
  La question doit être sur les fondamentaux des langages ainsi que des sujets moins connus.
  
  Dans la question ainsi que les options, évite le formatage de code.
  
  Tu dois être comme un recruteur posant des questions.
  
  Les réponses doivent être brèves et concises.
  
  Il doit y plusieurs choix de réponses mais une seule réponse correcte.
  
  Les réponses doivent avoir au maximum 5 choix.
  
  Les choix ne doivent pas dépasser 100 caractères.
  
  Les questions doivent être spécifiques et non générales.
  
  Les réponses doivent être en français.
  
  Le tableau des options peut contenir de 2 à 5 options.
  `;
  const result = await model.generateContent(prompt);
  const response = await result.response;
  const text = response.text();
  return JSON.parse(text);
};

const main = async (retry = false) => {
  try {
    const { question, options, correctOptionId } = await generateQuestionAndOptions();

    if ( question && options.length > 0 ) {
      console.log({ question, options, correctOptionId });
      await createTelegramPoll(botToken, chatId, question, options, correctOptionId);
    } else {
      console.error('No question or options generated');
      if ( !retry ) {
        console.log('Retrying...');
        await main(true);
      }
    }
  } catch ( error ) {
    console.error('Error in main function:', error);
    if ( !retry ) {
      console.log('Retrying...');
      await main(true);
    }
  }
};

app.get('/api/cron', async (req, res) => {
  await main();
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/plain');
  res.end('poll sent!\n');
});

app.listen(3000, () => {
  console.log(`Server running : http://localhost:${3000}/`);
});
