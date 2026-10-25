const fs = require('fs');

let content = fs.readFileSync('client/pages/booking/PaymentPage.tsx', 'utf8');

const target = `couponCode: appliedCoupon?.code,
          }),`;

const replacement = `couponCode: appliedCoupon?.code,
            attribution: (() => {
              try {
                const raw = sessionStorage.getItem("yes:attribution");
                return raw ? JSON.parse(raw) : (bookingData.attribution || undefined);
              } catch {
                return bookingData.attribution || undefined;
              }
            })(),
          }),`;

if (!content.includes('yes:attribution')) {
  // Support both CRLF and LF
  if (content.includes('couponCode: appliedCoupon?.code,\r\n          }),')) {
    content = content.replace(
      'couponCode: appliedCoupon?.code,\r\n          }),',
      `couponCode: appliedCoupon?.code,\r\n            attribution: (() => {\r\n              try {\r\n                const raw = sessionStorage.getItem("yes:attribution");\r\n                return raw ? JSON.parse(raw) : (bookingData.attribution || undefined);\r\n              } catch {\r\n                return bookingData.attribution || undefined;\r\n              }\r\n            })(),\r\n          }),`
    );
  } else {
    content = content.replace(target, replacement);
  }
  fs.writeFileSync('client/pages/booking/PaymentPage.tsx', content, 'utf8');
  console.log('Successfully added attribution tracking to PaymentPage.tsx');
} else {
  console.log('Attribution already present in PaymentPage.tsx');
}
