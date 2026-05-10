import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock, Mail, User, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { z } from "zod";
import logo from "@/assets/logo.png";
import { logAuthNav } from "@/lib/authNavLogger";

const loginSchema = z.object({
  email: z.string().email({ message: "البريد الإلكتروني غير صالح" }),
  password: z.string().min(6, { message: "كلمة المرور يجب أن تكون 6 أحرف على الأقل" }),
});

const signupSchema = loginSchema.extend({
  fullName: z.string().min(2, { message: "الاسم يجب أن يكون حرفين على الأقل" }),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "كلمات المرور غير متطابقة",
  path: ["confirmPassword"],
});

export default function Auth() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signUp, user, isLoading: authLoading, userRoles, userDataReady } = useAuth();
  const { toast } = useToast();
  
  const initialMode = new URLSearchParams(location.search).get('mode');
  const [isLogin, setIsLogin] = useState(initialMode !== 'signup');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirmPassword: "",
    fullName: "",
  });

  // Redirect if already logged in.
  // IMPORTANT: do NOT auto-redirect to /onboarding from here — that path is
  // strictly for new signups (handled explicitly in handleSubmit below).
  // Existing users who land on /auth while authenticated should always go
  // to their previous page or the dashboard. ProtectedRoute will handle
  // any further redirection if they happen to have no organization yet.
  useEffect(() => {
    if (user && !authLoading && userDataReady) {
      const from = (location.state as any)?.from?.pathname;
      const to = from || '/dashboard';
      logAuthNav("auth_already_logged_in", {
        from: location.pathname + location.search,
        to,
        userId: user.id,
        meta: { userRolesCount: userRoles?.length ?? 0, userDataReady },
      });
      navigate(to, { replace: true });
    }
  }, [user, authLoading, userDataReady, navigate, location, userRoles]);

  const validateForm = () => {
    try {
      if (isLogin) {
        loginSchema.parse(formData);
      } else {
        signupSchema.parse(formData);
      }
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            newErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(newErrors);
      }
      return false;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setIsLoading(true);

    try {
      if (isLogin) {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          logAuthNav("signin_error", { meta: { message: error.message } });
          if (error.message.includes('Invalid login credentials')) {
            toast({
              title: "خطأ في تسجيل الدخول",
              description: "البريد الإلكتروني أو كلمة المرور غير صحيحة",
              variant: "destructive",
            });
          } else {
            toast({
              title: "خطأ",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          logAuthNav("signin_success", { meta: { email: formData.email } });
          toast({
            title: "تم تسجيل الدخول بنجاح",
            description: "مرحباً بك",
          });
        }
      } else {
        const { error } = await signUp(formData.email, formData.password, formData.fullName);
        if (error) {
          logAuthNav("signup_error", { meta: { message: error.message } });
          if (error.message.includes('already registered')) {
            toast({
              title: "خطأ في التسجيل",
              description: "هذا البريد الإلكتروني مسجل مسبقاً",
              variant: "destructive",
            });
          } else {
            toast({
              title: "خطأ",
              description: error.message,
              variant: "destructive",
            });
          }
        } else {
          logAuthNav("signup_success", { meta: { email: formData.email } });
          logAuthNav("redirect_to_onboarding", { from: "/auth", to: "/onboarding", meta: { reason: "new_signup" } });
          toast({
            title: "تم إنشاء الحساب بنجاح",
            description: "سيتم تحويلك لإعداد مؤسستك",
          });
          navigate('/onboarding');
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear error when user types
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Left Side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <div className="text-center">
            <img 
              src={logo} 
              alt="حساباتي" 
              className="w-24 h-24 mx-auto mb-6 rounded-2xl shadow-lg"
            />
            <h1 className="text-3xl font-bold text-foreground">
              {isLogin ? "مرحباً بك في حساباتي" : "إنشاء حساب جديد"}
            </h1>
            <p className="text-muted-foreground mt-2">
              {isLogin 
                ? "سجل الدخول للوصول إلى لوحة التحكم" 
                : "أنشئ حسابك مجاناً — الإعداد يستغرق أقل من دقيقة"}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الكامل</Label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="fullName"
                    name="fullName"
                    value={formData.fullName}
                    onChange={handleChange}
                    placeholder="أدخل اسمك الكامل"
                    className={`pr-11 h-12 bg-muted/50 border-border ${errors.fullName ? 'border-destructive' : ''}`}
                  />
                </div>
                {errors.fullName && (
                  <p className="text-sm text-destructive">{errors.fullName}</p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="example@email.com"
                  className={`pr-11 h-12 bg-muted/50 border-border ${errors.email ? 'border-destructive' : ''}`}
                  dir="ltr"
                />
              </div>
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`pr-11 pl-11 h-12 bg-muted/50 border-border ${errors.password ? 'border-destructive' : ''}`}
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                  <Input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    placeholder="••••••••"
                    className={`pr-11 pl-11 h-12 bg-muted/50 border-border ${errors.confirmPassword ? 'border-destructive' : ''}`}
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword}</p>
                )}
              </div>
            )}

            {isLogin && (
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                  <input
                    type="checkbox"
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  تذكرني
                </label>
                <a href="#" className="text-sm text-primary hover:underline">
                  نسيت كلمة المرور؟
                </a>
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full h-12"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
              ) : isLogin ? (
                "تسجيل الدخول"
              ) : (
                "إنشاء الحساب"
              )}
            </Button>
          </form>

          {/* Toggle Login/Signup */}
          <div className="text-center">
            <p className="text-muted-foreground">
              {isLogin ? "ليس لديك حساب؟" : "لديك حساب بالفعل؟"}
              <button
                type="button"
                onClick={() => {
                  setIsLogin(!isLogin);
                  setErrors({});
                  setFormData({ email: "", password: "", confirmPassword: "", fullName: "" });
                }}
                className="text-primary hover:underline mr-2 font-medium"
              >
                {isLogin ? "إنشاء حساب" : "تسجيل الدخول"}
              </button>
            </p>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground">
            حساباتي - نظام إدارة الإيرادات
          </p>
        </div>
      </div>

      {/* Right Side - Decorative */}
      <div className="hidden lg:flex flex-1 gradient-secondary items-center justify-center p-12 relative overflow-hidden">
        {/* Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 right-20 w-64 h-64 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-20 left-20 w-96 h-96 rounded-full bg-accent blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 text-center text-secondary-foreground max-w-lg">
          <img 
            src={logo} 
            alt="حساباتي" 
            className="w-40 h-40 mx-auto mb-8 rounded-3xl shadow-2xl animate-float"
          />
          <h2 className="text-4xl font-bold mb-4">
            حساباتي
          </h2>
          <p className="text-xl opacity-80 mb-8">
            تابع إيرادات جميع فروعك بسهولة عبر ربط واتساب والذكاء الاصطناعي
          </p>
          <div className="grid grid-cols-3 gap-4 text-center">
            {[
              { value: "100+", label: "عميل نشط" },
              { value: "10K+", label: "تحويل شهرياً" },
              { value: "99%", label: "وقت التشغيل" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="bg-secondary-foreground/10 backdrop-blur-sm rounded-xl p-4"
              >
                <p className="text-3xl font-bold">{stat.value}</p>
                <p className="text-sm opacity-80">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
