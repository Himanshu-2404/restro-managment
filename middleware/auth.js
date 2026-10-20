const jwt = require('jsonwebtoken');
exports.auth = (req,res,next)=>{
  const t=(req.headers.authorization||'').replace('Bearer ','');
  try{ req.user=jwt.verify(t,process.env.JWT_SECRET); next(); }catch{ res.status(401).json({error:'Please log in again'}); }
};
exports.allow = (...roles)=>(req,res,next)=> roles.includes(req.user.role)?next():res.status(403).json({error:'Not allowed for your role'});
