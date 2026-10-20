require('dotenv').config();
const express=require('express'),cors=require('cors'),path=require('path');
const db=require('./config/db');
const app=express();app.use(cors(),express.json(),express.static(path.join(__dirname,'public')));
app.use('/api',require('./routes'));

async function start(){
 try{
  await db.query('SELECT 1');
 }catch(error){
  console.error('Unable to connect to MySQL with the configured connection:',{
   user:process.env.DB_USER||'(not set)',
   host:process.env.DB_HOST||'(not set)',
   database:process.env.DB_NAME||'(not set)'
  });
  if(error.code==='ER_ACCESS_DENIED_ERROR'){
   console.error('MySQL rejected the username or password. Check DB_USER and DB_PASSWORD in .env; changing DB_NAME or database grants will not fix an invalid login.');
  }
  console.error(error.message);
  process.exitCode=1;
  return;
 }
 const port=process.env.PORT||3000;
 app.listen(port,()=>console.log('Running on http://localhost:'+port));
}

start().catch(error=>{
 console.error('Failed to start the server:',error);
 process.exitCode=1;
});
