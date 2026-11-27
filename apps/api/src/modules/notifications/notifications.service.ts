import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { NotificationCategory, NotificationEmailStatus, Prisma } from '@prisma/client';
import { createHash } from 'node:crypto';
import { PrismaService } from '../../prisma/prisma.service';

export const NOTIFICATION_CATEGORIES = Object.values(NotificationCategory);
export type NoticeCategory = NotificationCategory;

export interface NotificationNotice {
  profileId?: string | null;
  recipientEmail?: string | null;
  category: NoticeCategory;
  type: string;
  title: string;
  /** Safe preview text only. Never put symptoms, findings, prices, names, or evidence in this field. */
  body: string;
  /** Optional email-only action copy. Not returned by the in-app API. */
  emailText?: string;
  deduplicationScope: string;
  payload?: Prisma.InputJsonValue;
  locale?: 'en-IN' | 'bn-BD' | 'hi-IN';
}

const notificationMessages: Record<
  string,
  Partial<Record<'bn-BD' | 'hi-IN', { title: string; body: string }>>
> = {
  REPAIR_CASE_CREATED: {
    'bn-BD': {
      title: 'মেরামতের কেস তৈরি হয়েছে',
      body: 'মেরামতের কেস তৈরি হয়েছে। অগ্রগতি দেখতে সাইন ইন করুন।',
    },
    'hi-IN': {
      title: 'मरम्मत केस बनाया गया',
      body: 'मरम्मत केस बनाया गया है। प्रगति देखने के लिए साइन इन करें।',
    },
  },
  REPAIR_CASE_ASSIGNED: {
    'bn-BD': {
      title: 'মেরামতের কেস বরাদ্দ হয়েছে',
      body: 'একটি মেরামতের কেস আপনাকে বরাদ্দ করা হয়েছে। কেস দেখতে সাইন ইন করুন।',
    },
    'hi-IN': {
      title: 'मरम्मत केस सौंपा गया',
      body: 'एक मरम्मत केस आपको सौंपा गया है। केस देखने के लिए साइन इन करें।',
    },
  },
  DIAGNOSTIC_COMPLETED: {
    'bn-BD': {
      title: 'ডায়াগনস্টিক পর্যালোচনার জন্য প্রস্তুত',
      body: 'একটি মেরামত কেসের আপডেট দেখার জন্য প্রস্তুত।',
    },
    'hi-IN': { title: 'निदान समीक्षा के लिए तैयार है', body: 'मरम्मत केस का अपडेट देखने के लिए तैयार है।' },
  },
  CUSTOMER_APPROVAL_RECORDED: {
    'bn-BD': { title: 'গ্রাহক কোটেশনের উত্তর দিয়েছেন', body: 'গ্রাহকের উত্তর পর্যালোচনার জন্য প্রস্তুত।' },
    'hi-IN': { title: 'ग्राहक ने कोटेशन का जवाब दिया', body: 'ग्राहक का जवाब समीक्षा के लिए तैयार है।' },
  },
  REPAIR_COMPLETED: {
    'bn-BD': {
      title: 'মেরামতের কার্যপ্রবাহ সম্পন্ন',
      body: 'একটি মেরামত কেস সম্পন্ন হয়েছে। বিবরণের জন্য রেকর্ড দেখুন।',
    },
    'hi-IN': {
      title: 'मरम्मत कार्यप्रवाह पूरा',
      body: 'एक मरम्मत केस पूरा हो गया है। विवरण के लिए रिकॉर्ड देखें।',
    },
  },
  REPAIR_STATUS_CHANGED: {
    'bn-BD': {
      title: 'মেরামতের কেসের অবস্থা হালনাগাদ',
      body: 'মেরামতের কেসের অবস্থা পরিবর্তিত হয়েছে। সর্বশেষ আপডেট দেখতে সাইন ইন করুন।',
    },
    'hi-IN': {
      title: 'मरम्मत केस की स्थिति अपडेट हुई',
      body: 'मरम्मत केस की स्थिति बदली है। नवीनतम अपडेट देखने के लिए साइन इन करें।',
    },
  },
  CUSTOMER_REQUESTED_QUOTATION_CHANGES: {
    'bn-BD': {
      title: 'গ্রাহক কোটেশনে পরিবর্তন চেয়েছেন',
      body: 'গ্রাহক মেরামতের কোটেশন পর্যালোচনা ও পরিবর্তনের অনুরোধ করেছেন।',
    },
    'hi-IN': {
      title: 'ग्राहक ने कोटेशन में बदलाव माँगा',
      body: 'ग्राहक ने मरम्मत कोटेशन में बदलाव की समीक्षा का अनुरोध किया।',
    },
  },
  CUSTOMER_APPROVED_QUOTATION: {
    'bn-BD': {
      title: 'গ্রাহক কোটেশন অনুমোদন করেছেন',
      body: 'গ্রাহক মেরামতের কোটেশনে সাড়া দিয়েছেন। সিদ্ধান্ত দেখতে সাইন ইন করুন।',
    },
    'hi-IN': {
      title: 'ग्राहक ने कोटेशन स्वीकृत किया',
      body: 'ग्राहक ने मरम्मत कोटेशन का जवाब दिया। निर्णय देखने के लिए साइन इन करें।',
    },
  },
  CUSTOMER_REJECTED_QUOTATION: {
    'bn-BD': {
      title: 'গ্রাহক কোটেশন প্রত্যাখ্যান করেছেন',
      body: 'গ্রাহক মেরামতের কোটেশনে সাড়া দিয়েছেন। সিদ্ধান্ত দেখতে সাইন ইন করুন।',
    },
    'hi-IN': {
      title: 'ग्राहक ने कोटेशन अस्वीकार किया',
      body: 'ग्राहक ने मरम्मत कोटेशन का जवाब दिया। निर्णय देखने के लिए साइन इन करें।',
    },
  },
  NEW_QUOTATION: {
    'bn-BD': {
      title: 'মেরামতের কোটেশন পর্যালোচনার জন্য প্রস্তুত',
      body: 'মেরামতের কোটেশন পর্যালোচনা করতে নিরাপদ লিংক খুলুন।',
    },
    'hi-IN': {
      title: 'मरम्मत कोटेशन समीक्षा के लिए तैयार',
      body: 'मरम्मत कोटेशन देखने के लिए सुरक्षित लिंक खोलें।',
    },
  },
  CUSTOMER_APPROVAL_REQUESTED: {
    'bn-BD': {
      title: '???????? ??????? ????????',
      body: '???? ???????? ?????? ????????? ???? ????????? ?????????? ???? ???? ?? ?????',
    },
    'hi-IN': {
      title: '?????? ?? ???????? ?????? ??',
      body: '?????? ?? ?????? ???????? ?? ??? ????? ??? ??????? ?? ??? ???? ?? ?????',
    },
  },
  CERTIFICATE_ISSUED: {
    'bn-BD': {
      title: '???????? ??? ???? ??????',
      body: '???? ???????? ??? ????????? ????? ???? ?? ?????',
    },
    'hi-IN': {
      title: '?????? ?????????? ???? ???',
      body: '?????? ?????????? ????? ??? ????? ?? ??? ???? ?? ?????',
    },
  },
  PRICE_CHANGED: {
    'bn-BD': {
      title: 'মেরামতের কোটেশন হালনাগাদ হয়েছে',
      body: 'মেরামতের কোটেশনের মূল্য পরিবর্তিত হয়েছে। সিদ্ধান্ত নেওয়ার আগে সংশোধিত কোটেশন পর্যালোচনা করুন।',
    },
    'hi-IN': {
      title: 'मरम्मत कोटेशन अपडेट हुआ',
      body: 'मरम्मत कोटेशन का मूल्य बदला है। निर्णय से पहले संशोधित कोटेशन देखें।',
    },
  },
  WARRANTY_CLAIM_UPDATED: {
    'bn-BD': { title: 'ওয়ারেন্টি দাবির আপডেট', body: 'ওয়ারেন্টি দাবির একটি আপডেট দেখার জন্য প্রস্তুত।' },
    'hi-IN': { title: 'वारंटी दावे का अपडेट', body: 'वारंटी दावे का अपडेट देखने के लिए तैयार है।' },
  },
  DISPUTE_UPDATED: {
    'bn-BD': { title: 'বিরোধের অবস্থা হালনাগাদ', body: 'একটি মেরামত কেসের বিরোধে আপডেট আছে।' },
    'hi-IN': { title: 'विवाद की स्थिति अपडेट हुई', body: 'मरम्मत केस के विवाद में अपडेट है।' },
  },
};

const PREFERENCE_DEFAULTS = { inAppEnabled: true, emailEnabled: true, smsEnabled: false };
type SupportedLocale = NonNullable<NotificationNotice['locale']>;

function resolveLocale(value?: string | null): SupportedLocale {
  return value === 'bn-BD' || value === 'hi-IN' || value === 'en-IN' ? value : 'en-IN';
}

function localizeEmailText(locale: 'en-IN' | 'bn-BD' | 'hi-IN', type: string, emailText?: string) {
  if (!emailText || locale === 'en-IN') return emailText;
  const link = emailText.match(/https?:\/\/[^\s]+/)?.[0];
  if (!link) return emailText;
  if (type === 'NEW_QUOTATION' || type === 'PRICE_CHANGED') {
    return locale === 'bn-BD'
      ? `মেরামতের কোটেশন পর্যালোচনার জন্য প্রস্তুত। এই নিরাপদ লিংকে দেখে অনুমোদন, প্রত্যাখ্যান বা পরিবর্তনের অনুরোধ করুন: ${link}`
      : `मरम्मत कोटेशन समीक्षा के लिए तैयार है। इस सुरक्षित लिंक से देखकर स्वीकृत, अस्वीकार या बदलाव का अनुरोध करें: ${link}`;
  }
  return emailText;
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly publicFields = {
    id: true,
    type: true,
    category: true,
    title: true,
    body: true,
    payload: true,
    readAt: true,
    createdAt: true,
  };

  /** Transactional outbox insert. Provider calls happen only in workers after commit. */
  async enqueue(tx: Prisma.TransactionClient, notice: NotificationNotice) {
    if (!notice.profileId && !notice.recipientEmail) return;
    const [preference, recipientProfile] = notice.profileId
      ? await tx.notificationPreference
          .findUnique({
            where: {
              profileId_category: { profileId: notice.profileId, category: notice.category },
            },
          })
          .then(
            async (value) =>
              [
                value,
                await tx.profile.findUnique({
                  where: { id: notice.profileId! },
                  select: { locale: true },
                }),
              ] as const,
          )
      : ([null, null] as const);
    const locale = resolveLocale(notice.locale ?? recipientProfile?.locale);
    let localized = locale === 'en-IN' ? undefined : notificationMessages[notice.type]?.[locale];
    if (!localized && notice.type === 'WARRANTY_EXPIRING' && locale !== 'en-IN') {
      const days = notice.title.match(/(\d+)/)?.[1];
      localized =
        locale === 'bn-BD'
          ? {
              title: days
                ? `প্রায় ${days} দিনের মধ্যে ওয়ারেন্টির মেয়াদ শেষ`
                : 'ওয়ারেন্টির মেয়াদ শিগগির শেষ',
              body: 'একটি ডিভাইসের ওয়ারেন্টির মেয়াদ কাছে এসেছে। কভারেজের বিবরণ দেখতে সাইন ইন করুন।',
            }
          : {
              title: days ? `लगभग ${days} दिनों में वारंटी समाप्त होगी` : 'वारंटी जल्द समाप्त होगी',
              body: 'डिवाइस की वारंटी समाप्ति के करीब है। कवरेज विवरण देखने के लिए साइन इन करें।',
            };
    }
    const emailEnabled = preference?.emailEnabled ?? PREFERENCE_DEFAULTS.emailEnabled;
    const inAppEnabled =
      Boolean(notice.profileId) && (preference?.inAppEnabled ?? PREFERENCE_DEFAULTS.inAppEnabled);
    const deduplicationKey = createHash('sha256')
      .update(`${notice.category}:${notice.deduplicationScope}:${notice.profileId ?? 'customer'}`)
      .digest('hex');

    await tx.notification.createMany({
      data: [
        {
          profileId: notice.profileId ?? null,
          recipientEmail: notice.recipientEmail ?? null,
          category: notice.category,
          type: notice.type,
          title: localized?.title ?? notice.title,
          body: localized?.body ?? notice.body,
          emailText: localizeEmailText(locale, notice.type, notice.emailText),
          payload: notice.payload ?? {},
          deduplicationKey,
          inAppVisible: inAppEnabled,
          emailStatus:
            emailEnabled && (notice.recipientEmail || notice.profileId)
              ? NotificationEmailStatus.QUEUED
              : NotificationEmailStatus.NOT_QUEUED,
        },
      ],
      skipDuplicates: true,
    });
  }

  async notifyCaseEvent(
    tx: Prisma.TransactionClient,
    input: {
      caseId: string;
      category: NoticeCategory;
      type: string;
      title: string;
      body: string;
      deduplicationScope: string;
      audience: 'CUSTOMER' | 'TECHNICIAN' | 'BOTH';
    },
  ) {
    const repairCase = await tx.repairCase.findUnique({
      where: { id: input.caseId },
      select: { customerEmail: true, customerLocale: true, technicianId: true },
    });
    if (!repairCase) return;
    const notice = {
      category: input.category,
      type: input.type,
      title: input.title,
      body: input.body,
      deduplicationScope: input.deduplicationScope,
      payload: { caseId: input.caseId },
    };
    if ((input.audience === 'CUSTOMER' || input.audience === 'BOTH') && repairCase.customerEmail) {
      await this.enqueue(tx, {
        ...notice,
        locale: repairCase.customerLocale as NotificationNotice['locale'],
        recipientEmail: repairCase.customerEmail,
      });
    }
    if ((input.audience === 'TECHNICIAN' || input.audience === 'BOTH') && repairCase.technicianId) {
      await this.enqueue(tx, { ...notice, profileId: repairCase.technicianId });
    }
  }

  list(profileId: string, limit = 25) {
    return this.prisma.notification.findMany({
      where: { profileId, inAppVisible: true },
      orderBy: { createdAt: 'desc' },
      take: limit,
      select: this.publicFields,
    });
  }

  async preferences(profileId: string) {
    const saved = await this.prisma.notificationPreference.findMany({ where: { profileId } });
    const byCategory = new Map(saved.map((item) => [item.category, item]));
    return NOTIFICATION_CATEGORIES.map((category) => ({
      category,
      ...(byCategory.get(category) ?? PREFERENCE_DEFAULTS),
    }));
  }

  async updatePreference(
    profileId: string,
    category: NoticeCategory,
    value: { inAppEnabled?: boolean; emailEnabled?: boolean; smsEnabled?: boolean },
  ) {
    if (value.smsEnabled === true)
      throw new BadRequestException(
        'SMS is not enabled until verified phone numbers, explicit consent, and a configured delivery provider are available',
      );
    const updated = await this.prisma.notificationPreference.upsert({
      where: { profileId_category: { profileId, category } },
      create: { profileId, category, ...PREFERENCE_DEFAULTS, ...value },
      update: value,
    });
    return updated;
  }

  async markRead(id: string, profileId: string) {
    const changed = await this.prisma.notification.updateMany({
      where: { id, profileId, inAppVisible: true, readAt: null },
      data: { readAt: new Date() },
    });
    if (!changed.count) {
      const existing = await this.prisma.notification.findFirst({
        where: { id, profileId, inAppVisible: true },
        select: this.publicFields,
      });
      if (!existing) throw new NotFoundException('Notification not found');
      return existing;
    }
    return this.prisma.notification.findFirst({
      where: { id, profileId, inAppVisible: true },
      select: this.publicFields,
    });
  }

  async deliveryStatus(id: string, profileId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id, profileId },
      select: {
        id: true,
        emailStatus: true,
        emailAttempts: true,
        emailSentAt: true,
        emailNextAttemptAt: true,
      },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return notification;
  }
}
