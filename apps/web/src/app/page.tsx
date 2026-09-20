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
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-10 text-center">
      <div className="grid gap-2">
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          LanguZe
        </h1>
        <p className="text-lg text-muted-foreground">
          เรียนภาษาอังกฤษจากสิ่งรอบตัวคุณ
        </p>
      </div>

      {account ? (
        <div className="grid w-full max-w-sm gap-4">
          <p className="text-base">สวัสดี {account.name}</p>

          {!account.verifiedForAi && account.email ? (
            <Alert className="text-left">
              <AlertTitle>ยืนยันอีเมลเพื่อปลดล็อกฟีเจอร์ AI</AlertTitle>
              <AlertDescription className="grid gap-2">
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
        <div className="flex flex-wrap items-center justify-center gap-3">
          <Link href="/sign-up" className={buttonVariants()}>
            สมัครใช้งาน
          </Link>
          <Link
            href="/sign-in"
            className={buttonVariants({ variant: 'outline' })}
          >
            เข้าสู่ระบบ
          </Link>
        </div>
      )}
    </main>
  );
}
