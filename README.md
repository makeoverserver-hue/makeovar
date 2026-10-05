# نظام إدارة عيادة التجميل والليزر

نظام متكامل (Full-stack) لإدارة عيادات التجميل والليزر باللغة العربية مع واجهة RTL.

## التقنيات (Tech Stack)

| الطبقة | التقنية |
|--------|---------|
| **Backend** | Node.js + Express.js |
| **Database** | SQLite عبر Prisma ORM |
| **Auth** | JWT (Access + Refresh tokens) |
| **RBAC** | 7 أدوار (مدير نظام، مدير، مشرف، استقبال، طبيب، ممرض، فني) |
| **Frontend** | React 18 + Vite |
| **UI** | TailwindCSS + Arabic RTL |
| **Charts** | Recharts |

## البنية (Architecture)

```
clinic/
├── backend/              # Express API server :5000
│   ├── prisma/
│   │   └── schema.prisma # جميع جداول قاعدة البيانات والعلاقات
│   └── src/
│       ├── controllers/  # منطق الأعمال لكل وحدة
│       ├── routes/       # تعريف المسارات
│       ├── middleware/   # Auth, RBAC, Validation, Audit
│       └── utils/        # أدوات مساعدة
├── frontend/             # React SPA :5173
│   └── src/
│       ├── pages/        # صفحات جميع الوحدات
│       ├── components/   # مكونات مشتركة (جداول، نماذج، تنبيهات)
│       └── services/     # طبقة API
└── uploads/              # صور المرضى ونماذج الموافقة
```

## الوحدات (Modules)

- **المرضى والملف الطبي**: بيانات المريض، الحساسية، الأمراض المزمنة، السجلات الطبية
- **المواعيد والتقويم**: حجز، تأكيد، حضور، إكمال، إلغاء
- **الخدمات والأجهزة**: خدمات بأسعار وتكاليف، أجهزة (Laser/Vivace/ONDA) بإعدادات قابلة للتهيئة من لوحة الإدارة
- **جلسات العلاج**: تسجيل الجلسات، استخدام الأجهزة، حالات الجلسات
- **خطط العلاج**: خدمات متعددة مع عدد جلسات وتقدم
- **الباقات**: تجميع خدمات، بيع باقات
- **الصور قبل/بعد**: رفع وعرض صور المرضى
- **نماذج الموافقة**: إنشاء وتوقيع إلكتروني
- **الفواتير والمدفوعات**: إنشاء فواتير، دفعات جزئية، طرق دفع متعددة
- **المخزون**: عناصر، حركات، تنبيهات انخفاض
- **الموظفين والعمولات**: أدوار، عمولات، رواتب
- **التقارير**: إيرادات، علاجات، أجهزة، مخزون، لوحة تحكم شاملة
- **الفروع**: إدارة فروع متعددة
- **سجل التدقيق (Audit Logs)**: تتبع كل عمليات النظام
- **الإعدادات**: إعدادات عامة، أجهزة، إشعارات، فواتير

> الإعدادات قابلة للتعديل من لوحة الإدارة ولا يتم افتراض أي بروتوكولات أو إعدادات علاجية تلقائية.

## التشغيل (Setup)

### 1. Backend
```bash
cd backend
npm install
npx prisma db push        # إنشاء قاعدة البيانات
node src/utils/seed.js    # إنشاء المستخدمين الأوائل
npm run dev               # تشغيل على http://localhost:5000
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev               # تشغيل على http://localhost:5173
```

افتح المتصفح على `http://localhost:5173`

## حسابات الدخول

| الدور | البريد الإلكتروني | كلمة المرور |
|-------|-------------------|--------------|
| مدير النظام | admin@clinic.com | Admin@123 |
| طبيب | doctor@clinic.com | Doctor@123 |
| استقبال | reception@clinic.com | Reception@123 |

## واجهة API الرئيسية

```
POST   /api/auth/login          تسجيل الدخول
GET    /api/patients            قائمة المرضى
POST   /api/patients            إنشاء مريض
GET    /api/appointments        المواعيد
POST   /api/services            إنشاء خدمة
POST   /api/devices             إنشاء جهاز
POST   /api/sessions            إنشاء جلسة
POST   /api/plans               إنشاء خطة علاج
POST   /api/packages            إنشاء باقة
POST   /api/invoices            إنشاء فاتورة
POST   /api/invoices/:id/payments  تسجيل دفعة
GET    /api/reports/dashboard   إحصائيات لوحة التحكم
```

جميع المسارات ما عدا `/api/auth/login` محمية بـ JWT + RBAC.
