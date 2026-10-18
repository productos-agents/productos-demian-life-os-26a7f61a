export function budgetPeriodStart(startDate, period, today) {
  const start = new Date(startDate.slice(0,10) + "T12:00:00Z");
  const now = new Date(today + "T12:00:00Z");
  if (!Number.isFinite(start.getTime()) || start > now) return startDate.slice(0,10);
  if (period === "weekly") {
    const elapsed = Math.floor((now.getTime()-start.getTime())/86400000);
    start.setUTCDate(start.getUTCDate()+Math.floor(elapsed/7)*7);
  } else if (period === "monthly") {
    const candidate=(year,month)=>new Date(Date.UTC(year,month,Math.min(start.getUTCDate(),new Date(Date.UTC(year,month+1,0)).getUTCDate()),12));
    let next=candidate(now.getUTCFullYear(),now.getUTCMonth());
    if(next>now)next=candidate(now.getUTCFullYear(),now.getUTCMonth()-1);
    start.setTime(next.getTime());
  } else {
    const candidate=(year)=>new Date(Date.UTC(year,start.getUTCMonth(),Math.min(start.getUTCDate(),new Date(Date.UTC(year,start.getUTCMonth()+1,0)).getUTCDate()),12));
    let next=candidate(now.getUTCFullYear());
    if(next>now)next=candidate(now.getUTCFullYear()-1);
    start.setTime(next.getTime());
  }
  return start.getUTCFullYear()+"-"+String(start.getUTCMonth()+1).padStart(2,"0")+"-"+String(start.getUTCDate()).padStart(2,"0");
}
