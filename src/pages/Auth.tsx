import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { REX_BUILD } from "@/lib/rexos";
import {
  ArrowLeft,
  ArrowRight,
  Loader2,
  Mail,
  ShieldCheck,
  UserX,
} from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

interface AuthProps {
  redirectAfterAuth?: string;
}

function resolveRedirectAfterAuth(
  returnTo: string | null,
  fallback = "/dashboard",
) {
  if (returnTo?.startsWith("/") && !returnTo.startsWith("//")) {
    return returnTo;
  }
  return fallback;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = resolveRedirectAfterAuth(
    searchParams.get("returnTo"),
    redirectAfterAuth,
  );
  const [step, setStep] = useState<"signIn" | { email: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirect]);
  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Email sign-in error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to send verification code. Please try again.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);

      console.log("signed in");

      navigate(redirect);
    } catch (error) {
      console.error("OTP verification error:", error);

      setError("The verification code you entered is incorrect.");
      setIsLoading(false);

      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      console.log("Attempting anonymous sign in...");
      await signIn("anonymous");
      console.log("Anonymous sign in successful");
      navigate(redirect);
    } catch (error) {
      console.error("Guest login error:", error);
      console.error("Error details:", JSON.stringify(error, null, 2));
      setError(`Failed to sign in as guest: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="rex-grid relative flex min-h-dvh flex-col overflow-hidden">
      {/* Back to landing */}
      <div className="absolute left-4 top-4 z-10 sm:left-6 sm:top-6">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground"
          onClick={() => navigate("/")}
        >
          <ArrowLeft className="size-4" />
          Back to landing
        </Button>
      </div>

      {/* Auth Content */}
      <div className="relative flex flex-1 items-center justify-center px-4 py-16">
        <div className="flex w-full max-w-md flex-col items-center">
          <Card className="w-full overflow-hidden border-border/80 bg-card/90 pb-0 shadow-lg backdrop-blur">
            {step === "signIn" ? (
              <>
                <CardHeader className="items-center text-center">
                  <div className="flex justify-center">
                    <img
                      src={logo}
                      alt="REX OS logo"
                      width={64}
                      height={64}
                      className="mb-4 mt-4 cursor-pointer rounded-xl transition-transform duration-200 hover:scale-105"
                      onClick={() => navigate("/")}
                    />
                  </div>
                  <CardTitle className="text-xl tracking-tight">
                    Welcome to REX OS
                  </CardTitle>
                  <CardDescription>
                    Sign in with your email, or continue as a guest
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent>
                    <div className="flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          name="email"
                          placeholder="name@example.com"
                          type="email"
                          className="pl-9"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        size="icon"
                        disabled={isLoading}
                        aria-label="Send verification code"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-destructive">{error}</p>
                    )}

                    <div className="mt-5">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border/70" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card px-2 text-muted-foreground">
                            Or
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="mt-5 w-full gap-2"
                        onClick={handleGuestLogin}
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <UserX className="h-4 w-4" />
                        )}
                        Continue as Guest
                      </Button>
                    </div>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="mt-4 items-center text-center">
                  <div className="mb-3 flex size-11 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                    <Mail className="size-5" />
                  </div>
                  <CardTitle className="text-xl tracking-tight">
                    Check your email
                  </CardTitle>
                  <CardDescription>
                    We&apos;ve sent a verification code to{" "}
                    <span className="font-medium text-foreground">
                      {step.email}
                    </span>
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) {
                              form.requestSubmit();
                            }
                          }
                        }}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="mt-2 text-center text-sm text-destructive">
                        {error}
                      </p>
                    )}
                    <p className="mt-4 text-center text-sm text-muted-foreground">
                      Didn&apos;t receive a code?{" "}
                      <Button
                        variant="link"
                        className="h-auto p-0"
                        onClick={() => setStep("signIn")}
                      >
                        Try again
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2">
                    <Button
                      type="submit"
                      className="w-full"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Verifying...
                        </>
                      ) : (
                        <>
                          Verify code
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full"
                    >
                      Use different email
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}

            <div className="flex items-center justify-between border-t border-border/70 bg-muted/40 px-6 py-3.5">
              <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <ShieldCheck className="size-3.5 text-primary/80" />
                Secured by freebuff.com
              </span>
              <span className="font-mono text-[10px] tracking-wider text-muted-foreground/70">
                {REX_BUILD}
              </span>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense>
      <Auth {...props} />
    </Suspense>
  );
}
