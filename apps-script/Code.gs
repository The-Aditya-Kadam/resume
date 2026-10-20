/** Resume alerts. Deploy as the owner, adityakadam66@gmail.com.
 * Set VISIT_ALERT_SECRET in Project Settings > Script properties.
 * Never put a secret into this source or a browser tag.
 */
var ALERT_OWNER = 'adityakadam66@gmail.com';
var ALERT_TO = 'adityakadamjd@gmail.com';
var ALERT_URL = 'https://aditya-kadam-resume.onrender.com/';

function alertMessage_(timestamp) {
  var time = Utilities.formatDate(new Date(timestamp), 'Asia/Kolkata', 'dd MMMM yyyy, hh:mm a') + ' IST';
  return {
    to: ALERT_TO,
    name: 'Aditya Kadam · Resume Alerts',
    subject: 'Someone visited your résumé, Aditya',
    body: 'Aditya Kadam · Résumé Visit Alert\n\nPage: Résumé homepage\nTime: ' + time + '\nAction: Page opened\n\nView my résumé: ' + ALERT_URL + '\n\nOne alert per 30-minute browser session. This alert does not identify the visitor; some automated visits may trigger alerts.',
    htmlBody: '<!doctype html><html><body style="margin:0;padding:24px 12px;background:#f7faff;font-family:Arial,sans-serif;color:#101828">' +
      '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center">' +
      '<table role="presentation" width="560" cellspacing="0" cellpadding="0" style="width:100%;max-width:560px;background:#ffffff;border:1px solid #dbe3ef;border-radius:16px;overflow:hidden">' +
      '<tr><td style="height:6px;background:#1f5fe0"></td></tr>' +
      '<tr><td style="padding:32px"><p style="margin:0 0 12px;color:#1f5fe0;font-size:12px;font-weight:bold;letter-spacing:2px">ADITYA KADAM</p>' +
      '<h1 style="margin:0 0 12px;font-size:27px;line-height:1.25">Résumé Visit Alert</h1>' +
      '<p style="margin:0 0 24px;color:#475467;line-height:1.6">Someone opened your résumé website.</p>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eef3fa;border-radius:12px">' +
      '<tr><td style="padding:18px 20px;color:#475467">Page</td><td style="padding:18px 20px;font-weight:bold">Résumé homepage</td></tr>' +
      '<tr><td style="padding:0 20px 18px;color:#475467">Time</td><td style="padding:0 20px 18px">' + time + '</td></tr>' +
      '<tr><td style="padding:0 20px 18px;color:#475467">Action</td><td style="padding:0 20px 18px">Page opened</td></tr></table>' +
      '<p style="margin:28px 0"><a href="' + ALERT_URL + '" style="display:inline-block;background:#1f5fe0;color:#ffffff;text-decoration:none;padding:14px 22px;border-radius:8px;font-weight:bold">View my résumé</a></p>' +
      '<p style="margin:0;font-size:12px;line-height:1.6;color:#475467">One alert per 30-minute browser session. This alert does not identify the visitor; some automated visits may trigger alerts.</p>' +
      '</td></tr></table></td></tr></table></body></html>'
  };
}

function json_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  var lock;
  try {
    if (!e || !e.postData || e.postData.contents.length > 2048) return json_({ok:false});
    var properties = PropertiesService.getScriptProperties();
    var secret = properties.getProperty('VISIT_ALERT_SECRET');
    if (!secret || secret.length < 32) return json_({ok:false});
    var request = JSON.parse(e.postData.contents);
    if (typeof request.payload !== 'string' || !/^[a-f0-9]{64}$/.test(request.signature || '')) return json_({ok:false});
    var expected = Utilities.computeHmacSha256Signature(request.payload, secret, Utilities.Charset.UTF_8)
      .map(function(b){return ('0' + (b & 255).toString(16)).slice(-2);}).join('');
    var difference = 0;
    for (var i=0;i<64;i++) difference |= expected.charCodeAt(i) ^ request.signature.charCodeAt(i);
    if (difference) return json_({ok:false});
    var event = JSON.parse(request.payload);
    var when = Date.parse(event.timestamp);
    if (!/^[a-f0-9]{64}$/.test(event.eventId || '') || !isFinite(when) || Math.abs(Date.now()-when) > 300000) return json_({ok:false});
    if (Session.getEffectiveUser().getEmail().toLowerCase() !== ALERT_OWNER) return json_({ok:false});
    lock = LockService.getScriptLock();
    if (!lock.tryLock(5000)) return json_({ok:false});
    var now = new Date(), day = now.toISOString().slice(0,10), hour = now.toISOString().slice(0,13);
    var state = JSON.parse(properties.getProperty('ALERT_LIMITS') || '{}');
    if (state.day !== day) state = {day:day, daily:0, hour:hour, hourly:0, recent:[]};
    if (state.hour !== hour) { state.hour=hour; state.hourly=0; }
    state.recent = (state.recent || []).filter(function(item){return Date.now()-item.at<600000;});
    if (state.recent.some(function(item){return item.id===event.eventId;})) return json_({ok:true,duplicate:true});
    if (state.daily>=90 || state.hourly>=20 || MailApp.getRemainingDailyQuota()<1) return json_({ok:false});
    state.daily++; state.hourly++; state.recent.push({id:event.eventId,at:Date.now()});
    properties.setProperty('ALERT_LIMITS',JSON.stringify(state));
    MailApp.sendEmail(alertMessage_(event.timestamp));
    return json_({ok:true});
  } catch(error) {
    console.error('RESUME_ALERT_FAILED');
    return json_({ok:false});
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

function doGet() { return json_({ok:true,service:'Resume visit alerts',version:1}); }

// Run once in the editor to request only the email-sending authorization.
function authorizeAlerts() {
  if (Session.getEffectiveUser().getEmail().toLowerCase() !== ALERT_OWNER) throw new Error('Use the configured sender account.');
  console.log('Mail authorization ready. Remaining recipients: ' + MailApp.getRemainingDailyQuota());
}
