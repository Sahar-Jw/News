import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The Services page (the old Membership page): the chamber's main services, each explained and tied to the department in charge.
 * Services are `news` rows of the category SERVICE (the same rows the One-Stop window and Settings > Services edit); the department
 * names below are starting values, change them from Settings. Each row is created once (marked with extra.seedKey) and an existing one is never touched,
 * so a service that is edited or deleted later is not brought back.
 */
const SERVICES: any[] = [
  {
    "key": "membership",
    "kind": "membership",
    "o": 10,
    "ar": "الانتساب إلى الغرفة",
    "en": "Joining the Chamber",
    "dAr": "تسجيل المنشأة التجارية عضواً في غرفة تجارة دمشق، وهو الأساس للاستفادة من خدمات الغرفة ومشاركتها في الفعاليات والمعارض والتمثيل أمام الجهات الرسمية. تُقدَّم الطلبات إلكترونياً مع الوثائق المطلوبة، ويُبلَّغ مقدّم الطلب بالنتيجة على بريده الإلكتروني.",
    "dEn": "Registering a business as a member of the Damascus Chamber of Commerce: the basis for using the Chamber’s services, taking part in its events and exhibitions and being represented before official bodies. Applications are submitted online with the required documents and the applicant is told the result by e-mail.",
    "aAr": "أصحاب المنشآت التجارية والصناعية والخدمية، أفراداً وشركات",
    "aEn": "Owners of commercial, industrial and service businesses, individuals and companies",
    "docAr": "صورة عن السجل التجاري\nصورة عن هوية صاحب المنشأة أو المفوض بالتوقيع\nما يثبت عنوان المنشأة ونشاطها",
    "docEn": "Copy of the commercial register\nCopy of the ID of the owner or authorised signatory\nProof of the business address and activity",
    "sAr": "تعبئة نموذج الانتساب الإلكتروني\nإرفاق الوثائق المطلوبة\nمراجعة الطلب من قبل القسم المختص\nإشعار بالنتيجة ورقم العضوية",
    "sEn": "Fill in the online membership form\nAttach the required documents\nThe responsible department reviews the request\nYou are notified of the result and your membership number",
    "dpAr": "قسم الانتساب وشؤون الأعضاء",
    "dpEn": "Membership & Members Affairs Department",
    "loc": "/membership"
  },
  {
    "key": "renewal",
    "kind": "renewal",
    "o": 20,
    "ar": "تجديد الانتساب",
    "en": "Membership renewal",
    "dAr": "تجديد عضوية المنشأة في الغرفة قبل انتهاء مدتها للحفاظ على مزايا العضوية دون انقطاع، مع تحديث بيانات المنشأة عند الحاجة.",
    "dEn": "Renewing the business’s membership before it expires so the benefits continue without a break, updating the business details when needed.",
    "aAr": "الأعضاء الحاليون في الغرفة",
    "aEn": "Current members of the Chamber",
    "docAr": "رقم العضوية أو صورة عن بطاقة العضوية\nصورة حديثة عن السجل التجاري\nإيصال دفع رسم التجديد",
    "docEn": "Membership number or a copy of the membership card\nA recent copy of the commercial register\nReceipt of the renewal fee",
    "sAr": "تقديم طلب التجديد وتحديث البيانات\nإرفاق الوثائق\nدفع رسم التجديد\nاستلام تأكيد التجديد",
    "sEn": "Submit the renewal request and update the details\nAttach the documents\nPay the renewal fee\nReceive the renewal confirmation",
    "dpAr": "قسم الانتساب وشؤون الأعضاء",
    "dpEn": "Membership & Members Affairs Department",
    "loc": null
  },
  {
    "key": "consulting",
    "kind": "consulting",
    "o": 30,
    "ar": "الاستشارات",
    "en": "Consultations",
    "dAr": "استشارات متخصصة للأعضاء ورواد الأعمال في الشؤون التجارية والقانونية والتصدير والاستيراد وإجراءات تأسيس الأعمال وتنميتها.",
    "dEn": "Specialised advice for members and entrepreneurs on commercial and legal matters, export and import, and setting up and growing a business.",
    "aAr": "الأعضاء ورواد الأعمال والمستثمرون",
    "aEn": "Members, entrepreneurs and investors",
    "docAr": "وصف موجز للاستفسار أو الحالة\nبيانات التواصل مع مقدّم الطلب",
    "docEn": "A short description of the question or case\nContact details of the applicant",
    "sAr": "تحديد موضوع الاستشارة\nتحويل الطلب إلى المختص\nتحديد موعد أو الرد كتابياً",
    "sEn": "State the subject of the consultation\nThe request is passed to the specialist\nAn appointment is set or a written answer is sent",
    "dpAr": "قسم الاستشارات والدراسات",
    "dpEn": "Consultations & Studies Department",
    "loc": null
  },
  {
    "key": "commercial",
    "kind": "commercial",
    "o": 40,
    "ar": "خدمات القطاع التجاري",
    "en": "Commercial sector services",
    "dAr": "خدمات تدعم عمل التجار والمنشآت: التعريف بالمنشآت، الربط مع الجهات والشركاء، المشاركة في الوفود والمعارض، ومتابعة القضايا والتشريعات التي تمس القطاع التجاري.",
    "dEn": "Services that support traders and businesses: introducing businesses, connecting them with partners and bodies, joining delegations and exhibitions, and following the laws and issues that affect the commercial sector.",
    "aAr": "التجار والمنشآت التجارية الأعضاء",
    "aEn": "Member traders and commercial businesses",
    "docAr": "صورة عن السجل التجاري\nكتاب أو طلب يوضح الخدمة المطلوبة",
    "docEn": "Copy of the commercial register\nA letter or request stating the service needed",
    "sAr": "تقديم الطلب\nدراسته من قبل القسم المختص\nالتنسيق مع الجهات المعنية\nمتابعة الطلب حتى إنجازه",
    "sEn": "Submit the request\nThe responsible department studies it\nCoordination with the bodies concerned\nFollow-up until it is completed",
    "dpAr": "قسم الشؤون التجارية",
    "dpEn": "Commercial Affairs Department",
    "loc": null
  },
  {
    "key": "certificates",
    "kind": "certificate",
    "o": 50,
    "ar": "الشهادات والنماذج والطلبات",
    "en": "Certificates, forms and requests",
    "dAr": "إصدار الشهادات التي تحتاجها المنشأة (كشهادة العضوية والتعريف) وتقديم النماذج والطلبات المعتمدة في الغرفة، مع إمكانية تحميل النماذج وتعبئتها وتسليمها.",
    "dEn": "Issuing the certificates a business needs (such as a membership or identification certificate) and the Chamber’s approved forms and requests, which can be downloaded, filled in and handed in.",
    "aAr": "أعضاء الغرفة",
    "aEn": "Members of the Chamber",
    "docAr": "النموذج أو الطلب المعبأ\nصورة عن السجل التجاري\nصورة عن هوية مقدّم الطلب",
    "docEn": "The completed form or request\nCopy of the commercial register\nCopy of the applicant’s ID",
    "sAr": "تحميل النموذج المناسب وتعبئته\nتسليمه مع الوثائق\nدفع الرسم إن وُجد\nاستلام الشهادة",
    "sEn": "Download and fill in the right form\nHand it in with the documents\nPay the fee, if any\nReceive the certificate",
    "dpAr": "النافذة الواحدة",
    "dpEn": "One-Stop Window",
    "loc": "/one-stop"
  },
  {
    "key": "attestation",
    "kind": "attestation",
    "o": 60,
    "ar": "تصديق الوثائق",
    "en": "Document attestation",
    "dAr": "تصديق الفواتير والوثائق التجارية من الغرفة لاعتمادها لدى الجهات الرسمية والتجارية داخل البلاد وخارجها.",
    "dEn": "Attesting invoices and commercial documents so that official and commercial bodies at home and abroad accept them.",
    "aAr": "الأعضاء والمصدّرون والمستوردون",
    "aEn": "Members, exporters and importers",
    "docAr": "الوثيقة أو الفاتورة الأصلية مع صورة عنها\nصورة عن السجل التجاري\nهوية المراجع أو التفويض",
    "docEn": "The original document or invoice and a copy\nCopy of the commercial register\nID of the person submitting, or an authorisation",
    "sAr": "تسليم الوثائق\nالتدقيق من قبل القسم المختص\nدفع رسم التصديق\nاستلام الوثائق المصدّقة",
    "sEn": "Hand in the documents\nThe responsible department checks them\nPay the attestation fee\nCollect the attested documents",
    "dpAr": "قسم تصديق الوثائق",
    "dpEn": "Document Attestation Department",
    "loc": null
  },
  {
    "key": "eservices",
    "kind": "eservices",
    "o": 70,
    "ar": "الخدمات الإلكترونية",
    "en": "E-services",
    "dAr": "خدمات تُنجَز عبر الإنترنت دون الحاجة إلى مراجعة الغرفة: الانتساب إلكترونياً، وتقديم الطلبات، وتحميل النماذج، ومتابعة المعاملات.",
    "dEn": "Services completed online without visiting the Chamber: joining electronically, submitting requests, downloading forms and following up transactions.",
    "aAr": "جميع المستفيدين من خدمات الغرفة",
    "aEn": "Everyone who uses the Chamber’s services",
    "docAr": "بريد إلكتروني ورقم هاتف صالحان\nالوثائق المطلوبة للخدمة بصيغة PDF أو صورة",
    "docEn": "A valid e-mail address and phone number\nThe documents the service needs, as PDF or image",
    "sAr": "اختيار الخدمة الإلكترونية\nتعبئة النموذج وإرفاق الوثائق\nالحصول على رقم مرجعي\nمتابعة الطلب",
    "sEn": "Choose the e-service\nFill in the form and attach the documents\nGet a reference number\nFollow the request",
    "dpAr": "وحدة الخدمات الإلكترونية",
    "dpEn": "E-Services Unit",
    "loc": null
  },
  {
    "key": "origin",
    "kind": "origin",
    "o": 80,
    "ar": "شهادات المنشأ",
    "en": "Certificates of origin",
    "dAr": "إصدار شهادات المنشأ للبضائع المصدَّرة، وهي تثبت بلد المنشأ وتُطلب غالباً من جهات الاستيراد والجمارك.",
    "dEn": "Issuing certificates of origin for exported goods, which prove the country of origin and are usually required by importers and customs.",
    "aAr": "المصدّرون من أعضاء الغرفة",
    "aEn": "Exporters who are members of the Chamber",
    "docAr": "طلب إصدار شهادة المنشأ\nالفاتورة التجارية وقائمة التعبئة\nصورة عن السجل التجاري",
    "docEn": "Request for the certificate of origin\nThe commercial invoice and packing list\nCopy of the commercial register",
    "sAr": "تقديم الطلب مع الوثائق\nالتدقيق\nدفع الرسم\nاستلام الشهادة مصدّقة ومختومة",
    "sEn": "Submit the request with the documents\nChecking\nPay the fee\nCollect the signed and stamped certificate",
    "dpAr": "قسم شهادات المنشأ",
    "dpEn": "Certificates of Origin Department",
    "loc": null
  }
];

export class SeedChamberServices1766500000000 implements MigrationInterface {
  name = 'SeedChamberServices1766500000000';

  public async up(r: QueryRunner): Promise<void> {
    // a one-off: when this migration ran before (marker row), nothing is added again
    for (const s of SERVICES) {
      const extra = JSON.stringify({
        seedKey: s.key, kind: s.kind, sortOrder: s.o, isActive: true, nameEn: s.en, descriptionEn: s.dEn,
        audienceAr: s.aAr, audienceEn: s.aEn, documentsAr: s.docAr, documentsEn: s.docEn, stepsAr: s.sAr, stepsEn: s.sEn,
        departmentAr: s.dpAr, departmentEn: s.dpEn, departmentUrl: '/contact',
      });
      await r.query(
        `INSERT INTO news (created_at, updated_at, title, main_category, body, images, topics, publish_at, extra)
         SELECT now(), now(), $1, 'SERVICE', $2, '[]'::jsonb, '[]'::jsonb, now(), $3::jsonb
         WHERE NOT EXISTS (SELECT 1 FROM news WHERE main_category = 'SERVICE' AND extra->>'seedKey' = $4)`,
        [s.ar, s.dAr, extra, s.key],
      );
    }
  }

  public async down(r: QueryRunner): Promise<void> {
    await r.query(`DELETE FROM news WHERE main_category = 'SERVICE' AND extra->>'seedKey' = ANY($1)`, [SERVICES.map((s) => s.key)]);
  }
}
