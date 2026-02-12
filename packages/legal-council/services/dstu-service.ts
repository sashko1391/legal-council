/**
 * ДСТУ 4163-2020 Service
 * Ukrainian document formatting standards and requirements
 */

export interface DstuRequirement {
  section: string;
  requirement: string;
  mandatory: boolean;
  description: string;
}

export interface DocumentTemplate {
  documentType: string;
  requiredSections: string[];
  requiredRequisites: string[];
  dstuReference: string;
}

/**
 * ДСТУ 4163-2020: Діловодство й архівна справа. Терміни та визначення
 * Document structure and formatting requirements
 */
export const DSTU_REQUIREMENTS: DstuRequirement[] = [
  // Загальні вимоги до документів
  {
    section: 'Структура документу',
    requirement: 'Назва документу',
    mandatory: true,
    description: 'Кожен документ повинен мати чітку назву (ДОГОВІР, КОНТРАКТ тощо)',
  },
  {
    section: 'Структура документу',
    requirement: 'Дата складання',
    mandatory: true,
    description: 'Дата у форматі "[ДЕНЬ] [МІСЯЦЬ] [РІК] року" (наприклад, "15 лютого 2026 року")',
  },
  {
    section: 'Структура документу',
    requirement: 'Реєстраційний номер',
    mandatory: true,
    description: 'Унікальний номер документу (наприклад, "№ 123-ДГ")',
  },
  {
    section: 'Структура документу',
    requirement: 'Місце складання',
    mandatory: false,
    description: 'Населений пункт де укладається договір (наприклад, "м. Київ")',
  },
  
  // Преамбула
  {
    section: 'Преамбула',
    requirement: 'Повна назва сторін',
    mandatory: true,
    description: 'Повне найменування юридичних осіб або ПІБ фізичних осіб',
  },
  {
    section: 'Преамбула',
    requirement: 'Правова форма',
    mandatory: true,
    description: 'ТОВ, ФОП, АТ, Фізична особа тощо',
  },
  {
    section: 'Преамбула',
    requirement: 'Представники сторін',
    mandatory: true,
    description: 'ПІБ та посада особи, яка підписує договір',
  },
  {
    section: 'Преамбула',
    requirement: 'Підстава дій',
    mandatory: true,
    description: 'Статут, Положення, Доручення тощо',
  },
  {
    section: 'Преамбула',
    requirement: 'Умовні назви сторін',
    mandatory: true,
    description: 'Іменовані надалі "Замовник" та "Виконавець" відповідно',
  },
  
  // Основний текст
  {
    section: 'Предмет договору',
    requirement: 'Чітке визначення предмету',
    mandatory: true,
    description: 'Згідно ЦКУ ст. 638 - істотна умова договору',
  },
  {
    section: 'Права та обов\'язки',
    requirement: 'Права сторін',
    mandatory: true,
    description: 'Перелік прав кожної сторони договору',
  },
  {
    section: 'Права та обов\'язки',
    requirement: 'Обов\'язки сторін',
    mandatory: true,
    description: 'Перелік обов\'язків кожної сторони договору',
  },
  {
    section: 'Вартість та розрахунки',
    requirement: 'Вартість/ціна',
    mandatory: true,
    description: 'Згідно ЦКУ ст. 632 - істотна умова для оплатних договорів',
  },
  {
    section: 'Вартість та розрахунки',
    requirement: 'Порядок оплати',
    mandatory: true,
    description: 'Терміни, спосіб, реквізити для оплати',
  },
  {
    section: 'Строк дії',
    requirement: 'Дата початку дії',
    mandatory: true,
    description: 'З якої дати договір набуває чинності',
  },
  {
    section: 'Строк дії',
    requirement: 'Дата закінчення або умови',
    mandatory: true,
    description: 'До якої дати діє або умови припинення',
  },
  {
    section: 'Відповідальність',
    requirement: 'Санкції за порушення',
    mandatory: true,
    description: 'Штрафи, пеня, неустойка відповідно до ЦКУ',
  },
  {
    section: 'Вирішення спорів',
    requirement: 'Претензійний порядок',
    mandatory: true,
    description: 'Обов\'язковий для господарських договорів',
  },
  {
    section: 'Вирішення спорів',
    requirement: 'Підсудність',
    mandatory: true,
    description: 'Який суд розглядає спори (господарський/цивільний)',
  },
  
  // Підписи
  {
    section: 'Реквізити та підписи',
    requirement: 'Повні реквізити сторін',
    mandatory: true,
    description: 'Адреса, ЄДРПОУ/РНОКПП, р/р, банк, МФО',
  },
  {
    section: 'Реквізити та підписи',
    requirement: 'Підписи',
    mandatory: true,
    description: 'Посада, ПІБ, підпис уповноважених осіб',
  },
  {
    section: 'Реквізити та підписи',
    requirement: 'Печатки',
    mandatory: false,
    description: 'Печатки юридичних осіб (якщо є)',
  },
];

/**
 * Document templates by type
 */
export const DOCUMENT_TEMPLATES: DocumentTemplate[] = [
  {
    documentType: 'договір_купівлі_продажу',
    requiredSections: [
      '1. ПРЕДМЕТ ДОГОВОРУ',
      '2. ЦІНА ТА ПОРЯДОК РОЗРАХУНКІВ',
      '3. СТРОКИ ПЕРЕДАЧІ ТОВАРУ',
      '4. ЯКІСТЬ ТОВАРУ ТА ГАРАНТІЇ',
      '5. ПРАВА ТА ОБОВ\'ЯЗКИ СТОРІН',
      '6. ВІДПОВІДАЛЬНІСТЬ СТОРІН',
      '7. ПОРЯДОК ВИРІШЕННЯ СПОРІВ',
      '8. ФОРС-МАЖОР',
      '9. СТРОК ДІЇ ДОГОВОРУ',
      '10. ЗАКЛЮЧНІ ПОЛОЖЕННЯ',
      '11. РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН',
    ],
    requiredRequisites: [
      'Дата',
      'Номер',
      'Місце укладення',
      'Сторони',
      'Предмет',
      'Ціна',
      'Підписи',
    ],
    dstuReference: 'ДСТУ 4163-2020, ЦКУ ст. 700-717',
  },
  {
    documentType: 'трудовий_договір',
    requiredSections: [
      '1. ЗАГАЛЬНІ ПОЛОЖЕННЯ',
      '2. ПРАВА ТА ОБОВ\'ЯЗКИ ПРАЦІВНИКА',
      '3. ПРАВА ТА ОБОВ\'ЯЗКИ РОБОТОДАВЦЯ',
      '4. ОПЛАТА ПРАЦІ',
      '5. РЕЖИМ РОБОТИ ТА ВІДПОЧИНКУ',
      '6. ВІДПОВІДАЛЬНІСТЬ СТОРІН',
      '7. СТРОК ДІЇ ДОГОВОРУ',
      '8. ПІДСТАВИ ПРИПИНЕННЯ ДОГОВОРУ',
      '9. ЗАКЛЮЧНІ ПОЛОЖЕННЯ',
      '10. РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН',
    ],
    requiredRequisites: [
      'Дата',
      'Номер',
      'Місце роботи',
      'Посада',
      'Дата початку роботи',
      'Заробітна плата',
      'Підписи',
    ],
    dstuReference: 'ДСТУ 4163-2020, КЗпП ст. 21-24',
  },
  {
    documentType: 'договір_оренди',
    requiredSections: [
      '1. ПРЕДМЕТ ДОГОВОРУ',
      '2. СТРОК ОРЕНДИ',
      '3. ОРЕНДНА ПЛАТА ТА ПОРЯДОК РОЗРАХУНКІВ',
      '4. ПРАВА ТА ОБОВ\'ЯЗКИ ОРЕНДАРЯ',
      '5. ПРАВА ТА ОБОВ\'ЯЗКИ ОРЕНДОДАВЦЯ',
      '6. ВІДПОВІДАЛЬНІСТЬ СТОРІН',
      '7. ПОРЯДОК ПЕРЕДАЧІ ТА ПОВЕРНЕННЯ МАЙНА',
      '8. ПОРЯДОК ВИРІШЕННЯ СПОРІВ',
      '9. ФОРС-МАЖОР',
      '10. ЗАКЛЮЧНІ ПОЛОЖЕННЯ',
      '11. РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН',
    ],
    requiredRequisites: [
      'Дата',
      'Номер',
      'Предмет оренди',
      'Строк оренди',
      'Орендна плата',
      'Підписи',
    ],
    dstuReference: 'ДСТУ 4163-2020, ЦКУ ст. 759-786',
  },
  {
    documentType: 'договір_підряду',
    requiredSections: [
      '1. ПРЕДМЕТ ДОГОВОРУ',
      '2. СТРОКИ ВИКОНАННЯ РОБІТ',
      '3. ЦІНА ТА ПОРЯДОК РОЗРАХУНКІВ',
      '4. ПРАВА ТА ОБОВ\'ЯЗКИ ЗАМОВНИКА',
      '5. ПРАВА ТА ОБОВ\'ЯЗКИ ПІДРЯДНИКА',
      '6. ЗДАЧА ТА ПРИЙМАННЯ РОБІТ',
      '7. ВІДПОВІДАЛЬНІСТЬ СТОРІН',
      '8. ПОРЯДОК ВИРІШЕННЯ СПОРІВ',
      '9. ФОРС-МАЖОР',
      '10. ЗАКЛЮЧНІ ПОЛОЖЕННЯ',
      '11. РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН',
    ],
    requiredRequisites: [
      'Дата',
      'Номер',
      'Предмет робіт',
      'Строки',
      'Ціна',
      'Підписи',
    ],
    dstuReference: 'ДСТУ 4163-2020, ЦКУ ст. 837-862',
  },
  {
    documentType: 'NDA',
    requiredSections: [
      '1. ТЕРМІНИ ТА ВИЗНАЧЕННЯ',
      '2. ПРЕДМЕТ ДОГОВОРУ',
      '3. ЗОБОВ\'ЯЗАННЯ СТОРІН',
      '4. ВИКЛЮЧЕННЯ З КОНФІДЕНЦІЙНОЇ ІНФОРМАЦІЇ',
      '5. СТРОК ДІЇ ЗОБОВ\'ЯЗАНЬ',
      '6. ВІДПОВІДАЛЬНІСТЬ ЗА РОЗГОЛОШЕННЯ',
      '7. ПОРЯДОК ВИРІШЕННЯ СПОРІВ',
      '8. ЗАКЛЮЧНІ ПОЛОЖЕННЯ',
      '9. РЕКВІЗИТИ ТА ПІДПИСИ СТОРІН',
    ],
    requiredRequisites: [
      'Дата',
      'Номер',
      'Сторони',
      'Предмет конфіденційності',
      'Строк',
      'Підписи',
    ],
    dstuReference: 'ДСТУ 4163-2020, ЦКУ ст. 626-629',
  },
];

class DstuService {
  /**
   * Get ДСТУ requirements by section
   */
  getRequirementsBySection(section: string): DstuRequirement[] {
    return DSTU_REQUIREMENTS.filter((req) => req.section === section);
  }

  /**
   * Get mandatory requirements
   */
  getMandatoryRequirements(): DstuRequirement[] {
    return DSTU_REQUIREMENTS.filter((req) => req.mandatory);
  }

  /**
   * Get document template by type
   */
  getTemplate(documentType: string): DocumentTemplate | null {
    return (
      DOCUMENT_TEMPLATES.find((tpl) => tpl.documentType === documentType) || null
    );
  }

  /**
   * Validate document structure against ДСТУ
   */
  validateStructure(
    documentType: string,
    sections: string[]
  ): { valid: boolean; missing: string[] } {
    const template = this.getTemplate(documentType);
    if (!template) {
      return { valid: false, missing: ['Template not found'] };
    }

    const missing = template.requiredSections.filter(
      (reqSection) =>
        !sections.some((section) =>
          section.toLowerCase().includes(reqSection.toLowerCase())
        )
    );

    return {
      valid: missing.length === 0,
      missing,
    };
  }

  /**
   * Get all document types
   */
  getDocumentTypes(): string[] {
    return DOCUMENT_TEMPLATES.map((tpl) => tpl.documentType);
  }
}

export const dstuService = new DstuService();
