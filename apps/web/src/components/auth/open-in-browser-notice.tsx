'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { externalBrowserUrl, type InAppBrowser } from '@/lib/in-app-browser';

/**
 * Shown inside the LINE and Facebook in-app browsers, where Google refuses to run
 * its sign-in (US-006, NFR-018). The other methods still work here; this offers the
 * way back to the device's own browser, where every method works.
 *
 * The address is read in the browser rather than rebuilt on the server, so it is
 * always the page the learner is actually on.
 */
export function OpenInBrowserNotice({ browser }: { browser: InAppBrowser }) {
  const [copied, setCopied] = useState(false);

  const openExternally = () => {
    // LINE hands the address to the device browser when asked this way.
    window.location.assign(externalBrowserUrl(window.location.href));
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
    } catch {
      // Clipboard access can be refused; the learner can still use the app's menu.
      setCopied(false);
    }
  };

  return (
    <div className="glass-panel mt-4 grid gap-3 rounded-2xl p-4 text-left text-sm">
      <p className="text-muted-foreground">
        {browser === 'line'
          ? 'การเข้าสู่ระบบด้วย Google ใช้ไม่ได้ในเบราว์เซอร์ของ LINE หากต้องการใช้ Google กรุณาเปิด LanguZe ในเบราว์เซอร์ของเครื่อง'
          : 'การเข้าสู่ระบบด้วย Google ใช้ไม่ได้ในเบราว์เซอร์ของ Facebook หากต้องการใช้ Google กรุณาแตะปุ่ม ⋯ มุมขวาบน แล้วเลือก “เปิดในเบราว์เซอร์”'}
      </p>

      {browser === 'line' ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={openExternally}
        >
          เปิดในเบราว์เซอร์ของเครื่อง
        </Button>
      ) : (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full"
          onClick={() => void copyLink()}
        >
          {copied ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกลิงก์'}
        </Button>
      )}
    </div>
  );
}
