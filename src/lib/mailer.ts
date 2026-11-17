/**
 * [이 파일이 하는 일]
 * 명지대학교 웹메일(@mju.ac.kr)로 6자리 재학생 인증 코드를 발송하는 모듈입니다.
 * - SMTP 설정이 있는 경우: Nodemailer를 통해 실제 이메일 발송
 * - 로컬에서 SMTP가 완전히 미설정된 경우에만 콘솔 코드로 대체
 * - 운영에서는 코드 로그 금지, 설정/발송 실패는 503으로 전달
 */

import nodemailer, { type Transporter } from 'nodemailer';
import { isProductionEnvironment } from './env.js';

function mailUnavailable() {
  return Object.assign(new Error('인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해주세요.'), { statusCode: 503 });
}

// SMTP 전송 객체 (싱글톤)
let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) return null;

  if (host && user && pass) {
    if (transporter) return transporter;
    const port = Number(process.env.SMTP_PORT || 587);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw mailUnavailable();
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    });
  }

  return transporter;
}

/**
 * 6자리 학교 인증 코드 이메일 발송 함수
 * @param toEmail 수신자 명지대 이메일 (@mju.ac.kr)
 * @param code 6자리 숫자 인증 코드
 */
export async function sendVerificationEmail(toEmail: string, code: string): Promise<boolean> {
  const mailTransporter = getTransporter();
  const from = process.env.MAIL_FROM || `"명지대 혼밥지도 SoloMap" <no-reply@mju-solomap.com>`;

  if (!mailTransporter) {
    const hasPartialSmtp = [process.env.SMTP_HOST, process.env.SMTP_USER, process.env.SMTP_PASS].some(value => value?.trim());
    if (!isProductionEnvironment() && !hasPartialSmtp) {
      // 실제 메일 발송이 없는 로컬 개발에서만 코드 확인을 허용한다.
      console.log(`[DEV EMAIL] ${toEmail} 인증 코드: ${code} (유효시간: 10분)`);
      return true;
    }
    throw mailUnavailable();
  }

  try {
    const result = await mailTransporter.sendMail({
      from,
      to: toEmail,
      subject: '[SoloMap] 명지대학교 재학생 인증 코드입니다.',
      html: `
        <div style="font-family: 'Apple SD Gothic Neo', sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px;">
          <h2 style="color: #004b97; margin-bottom: 8px;">🎓 명지대학교 학생 인증</h2>
          <p style="color: #475569; font-size: 15px; line-height: 1.6;">
            명지대학교 혼밥지도(SoloMap)에 오신 것을 환영합니다!<br/>
            재학생 인증을 완료하기 위해 아래 6자리 인증 코드를 입력해주세요.
          </p>
          <div style="background-color: #f1f5f9; padding: 16px; border-radius: 8px; text-align: center; margin: 24px 0;">
            <span style="font-size: 32px; font-weight: 800; letter-spacing: 6px; color: #0f172a;">${code}</span>
          </div>
          <p style="color: #64748b; font-size: 13px;">
            * 본 인증 코드는 발송 시점으로부터 <strong>10분간 유효</strong>합니다.<br/>
            * 5회 이상 오입력 시 새 인증 코드를 요청하셔야 합니다.
          </p>
        </div>
      `,
    });
    if (!result.accepted?.length) throw mailUnavailable();
    return true;
  } catch {
    // SMTP 원본 오류에는 주소·서버 정보가 있을 수 있어 응답과 로그에 그대로 남기지 않는다.
    throw mailUnavailable();
  }
}
