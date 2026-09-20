import Link from 'next/link';
import {
  ResendVerificationButton,
  SignOutButton,
} from '@/components/auth/account-actions';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { buttonVariants } from '@/components/ui/button';
import { getAccount } from '@/lib/api/server';

export default async function Home() {
  const account = await getAccount();

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 px-4 py-10 text-center">
      <div className="grid gap-3">
        <h1 className="text-5xl font-extrabold tracking-tight sm:text-6xl">
          <span className="bg-linear-to-r from-primary via-primary to-highlight bg-clip-text text-transparent">
            LanguZe
          </span>
        </h1>
        <p className="text-lg text-muted-foreground">
          เรียนภาษาอังกฤษจากสิ่งรอบตัวคุณ
        </p>
      </div>

      {account ? (
        <div className="grid w-full max-w-sm gap-4">
          <p className="glass-pill justify-self-center rounded-full px-4 py-1.5 text-sm font-semibold">
            สวัสดี {account.name}
          </p>

          {!account.verifiedForAi && account.email ? (
            <Alert className="glass-panel rounded-2xl text-left">
              <AlertTitle className="font-bold">
                ยืนยันอีเมลเพื่อปลดล็อกฟีเจอร์ AI
              </AlertTitle>
              <AlertDescription className="grid gap-3">
                <span>
                  เราส่งลิงก์ยืนยันไปที่ {account.email} แล้ว
                  การวิเคราะห์รูปภาพและติวเตอร์ AI จะใช้ได้หลังยืนยันอีเมล
                </span>
                <ResendVerificationButton email={account.email} />
              </AlertDescription>
            </Alert>
          ) : null}

          <SignOutButton />
        </div>
      ) : (
        // Stacked and full width on a phone, side by side once there is room.
        <div className="grid w-full max-w-xs gap-3 sm:flex sm:max-w-none sm:justify-center">
          <Link
            href="/sign-up"
            className={buttonVariants({ variant: 'cta', size: 'xl' })}
          >
            สมัครใช้งาน
          </Link>
          <Link
            href="/sign-in"
            className={buttonVariants({ variant: 'outline', size: 'xl' })}
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      )}
    </main>
  );
}
