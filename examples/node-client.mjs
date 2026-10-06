import OpenAI from 'openai';
const client = new OpenAI({apiKey:process.env.LGW_API_KEY,baseURL:process.env.LGW_BASE_URL??'http://localhost:3000/v1'});
const result = await client.chat.completions.create({model:process.env.LGW_MODEL??'gpt-4o-mini',messages:[{role:'user',content:'Say hello in one short sentence.'}]});
console.log(result.choices[0]?.message?.content);