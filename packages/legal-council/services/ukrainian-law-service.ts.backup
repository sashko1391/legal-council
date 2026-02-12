/**
 * Ukrainian Law Service
 * Provides legal references and context for Ukrainian jurisdiction
 * 
 * MVP: Hardcoded common laws
 * Future: Scraping zakon.rada.gov.ua or Liga:ZAKON API
 */

import NodeCache from 'node-cache';

const lawCache = new NodeCache({ stdTTL: 86400 * 7 }); // Cache 7 days

// ==========================================
// COMMON UKRAINIAN LAWS (Hardcoded for MVP)
// ==========================================

interface LawInfo {
  fullName: string;
  code: string;
  url: string;
  keyArticles?: Record<string, string>;
}

const COMMON_LAWS: Record<string, LawInfo> = {
  'ЦКУ': {
    fullName: 'Цивільний кодекс України',
    code: 'ЦКУ',
    url: 'https://zakon.rada.gov.ua/laws/show/435-15',
    keyArticles: {
      '11': 'Цивільна правоздатність',
      '202': 'Правочин',
      '203': 'Види правочинів',
      '215': 'Недійсний правочин',
      '626': 'Договір (поняття)',
      '627': 'Зміст договору',
      '628': 'Свобода договору',
      '638': 'Істотні умови договору',
      '651': 'Форма договору',
      '526': 'Виконання зобов\'язання',
      '610': 'Відповідальність за невиконання',
      '1212': 'Відшкодування моральної шкоди',
    },
  },
  
  'ГКУ': {
    fullName: 'Господарський кодекс України',
    code: 'ГКУ',
    url: 'https://zakon.rada.gov.ua/laws/show/436-15',
    keyArticles: {
      '173': 'Господарський договір',
      '174': 'Вимоги до змісту господарського договору',
      '181': 'Зміст господарського договору',
      '193': 'Зміна та розірвання господарського договору',
      '230': 'Відповідальність суб\'єктів господарювання',
    },
  },
  
  'КЗпП': {
    fullName: 'Кодекс законів про працю України',
    code: 'КЗпП',
    url: 'https://zakon.rada.gov.ua/laws/show/322-08',
    keyArticles: {
      '21': 'Трудовий договір',
      '24': 'Строковий трудовий договір',
      '36': 'Підстави припинення трудового договору',
      '38': 'Розірвання за ініціативою працівника',
      '40': 'Розірвання за ініціативою власника',
      '94': 'Нормальна тривалість робочого часу',
      '115': 'Щорічна основна відпустка',
    },
  },
  
  'ЗУ_ПДВ': {
    fullName: 'Закон України "Про податок на додану вартість"',
    code: 'ПДВ',
    url: 'https://zakon.rada.gov.ua/laws/show/168/97-%D0%B2%D1%80',
    keyArticles: {
      '1': 'Визначення термінів',
      '3': 'Об\'єкт оподаткування',
      '7': 'Ставки податку',
    },
  },
};

// ==========================================
// ДСТУ DOCUMENT STANDARDS
// ==========================================

export const DSTU_STRUCTURE = {
  sections: [
    '1. ПРЕДМЕТ ДОГОВОРУ',
    '2. ВАРТІСТЬ ТА ПОРЯДОК РОЗРАХУНКІВ',
    '3. ПРАВА ТА ОБОВ\'ЯЗКИ СТОРІН',
    '4. ВІДПОВІДАЛЬНІСТЬ СТОРІН',
    '5. СТРОК ДІЇ ДОГОВОРУ',
    '6. ФОРС-МАЖОРНІ ОБСТАВИНИ',
    '7. ПОРЯДОК ВИРІШЕННЯ СПОРІВ',
    '8. ІНШІ УМОВИ',
    '9. ЮРИДИЧНІ АДРЕСИ ТА РЕКВІЗИТИ СТОРІН',
    '10. ПІДПИСИ СТОРІН',
  ],
  
  dateFormat: 'ДД.ММ.РРРР', // 01.02.2025, not Feb 1, 2025
  
  currencyFormat: '10 000 (десять тисяч) гривень 00 копійок',
  
  parties: {
    standard: ['Замовник', 'Виконавець'],
    employment: ['Роботодавець', 'Працівник'],
    vendor: ['Покупець', 'Продавець'],
  },
};

// ==========================================
// UKRAINIAN LAW SERVICE
// ==========================================

export class UkrainianLawService {
  
  /**
   * Get law reference with optional article
   */
  getLawReference(
    lawCode: keyof typeof COMMON_LAWS,
    article?: string
  ): string {
    const law = COMMON_LAWS[lawCode];
    
    if (!law) {
      return `Закон "${lawCode}"`;
    }
    
    if (article && law.keyArticles?.[article]) {
      return `${law.code}, стаття ${article} "${law.keyArticles[article]}"`;
    }
    
    return `${law.fullName} (${law.code})`;
  }
  
  /**
   * Get full law info
   */
  getLawInfo(lawCode: keyof typeof COMMON_LAWS): LawInfo | null {
    return COMMON_LAWS[lawCode] || null;
  }
  
  /**
   * Get all applicable laws for document type
   */
  getApplicableLaws(documentType: string): LawInfo[] {
    const laws: LawInfo[] = [];
    
    // Always include Civil Code
    laws.push(COMMON_LAWS['ЦКУ']);
    
    // Add specific laws based on type
    if (documentType.includes('employment') || documentType.includes('трудов')) {
      laws.push(COMMON_LAWS['КЗпП']);
    }
    
    if (documentType.includes('commercial') || documentType.includes('господарськ')) {
      laws.push(COMMON_LAWS['ГКУ']);
    }
    
    if (documentType.includes('vat') || documentType.includes('пдв')) {
      laws.push(COMMON_LAWS['ЗУ_ПДВ']);
    }
    
    return laws;
  }
  
  /**
   * Generate legal context for LLM prompt
   */
  async getLegalContext(documentType: string): Promise<string> {
    const applicableLaws = this.getApplicableLaws(documentType);
    
    let context = 'ЗАСТОСОВНЕ ЗАКОНОДАВСТВО УКРАЇНИ:\n\n';
    
    for (const law of applicableLaws) {
      context += `${law.fullName} (${law.code}):\n`;
      context += `Джерело: ${law.url}\n`;
      
      if (law.keyArticles) {
        context += 'Ключові статті:\n';
        for (const [article, description] of Object.entries(law.keyArticles)) {
          context += `  - Стаття ${article}: ${description}\n`;
        }
      }
      
      context += '\n';
    }
    
    return context;
  }
  
  /**
   * Search for law (MVP: returns zakon.rada.gov.ua link)
   * Future: Actual scraping or API call
   */
  async searchLaw(query: string): Promise<string> {
    // Check cache
    const cacheKey = `search:${query}`;
    const cached = lawCache.get<string>(cacheKey);
    if (cached) return cached;
    
    // For MVP: Just return search URL
    const searchUrl = `https://zakon.rada.gov.ua/laws/main?find=${encodeURIComponent(query)}`;
    
    lawCache.set(cacheKey, searchUrl);
    return searchUrl;
  }
  
  /**
   * Get ДСТУ-compliant document structure
   */
  getDSTUStructure(documentType: string): typeof DSTU_STRUCTURE {
    // Future: Different structures for different doc types
    return DSTU_STRUCTURE;
  }
  
  /**
   * Format date in Ukrainian standard
   */
  formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}.${month}.${year}`;
  }
  
  /**
   * Format currency amount
   */
  formatCurrency(amount: number): string {
    const formatter = new Intl.NumberFormat('uk-UA', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    
    const formatted = formatter.format(amount);
    const amountInWords = this.numberToWords(amount);
    
    return `${formatted} (${amountInWords}) гривень`;
  }
  
  /**
   * Convert number to Ukrainian words (simplified for MVP)
   */
  private numberToWords(num: number): string {
    // Simplified - only handles common amounts
    // Full implementation would use comprehensive number-to-words library
    
    const thousands = Math.floor(num / 1000);
    const hundreds = Math.floor((num % 1000) / 100);
    const tens = Math.floor((num % 100) / 10);
    const ones = num % 10;
    
    const digits = ['', 'одна', 'дві', 'три', 'чотири', 'п\'ять', 'шість', 'сім', 'вісім', 'дев\'ять'];
    const teens = ['десять', 'одинадцять', 'дванадцять', 'тринадцять', 'чотирнадцять', 'п\'ятнадцять', 'шістнадцять', 'сімнадцять', 'вісімнадцять', 'дев\'ятнадцять'];
    const tensWords = ['', '', 'двадцять', 'тридцять', 'сорок', 'п\'ятдесят', 'шістдесят', 'сімдесят', 'вісімдесят', 'дев\'яносто'];
    const hundredsWords = ['', 'сто', 'двісті', 'триста', 'чотириста', 'п\'ятсот', 'шістсот', 'сімсот', 'вісімсот', 'дев\'ятсот'];
    
    let result = '';
    
    if (thousands > 0) {
      result += digits[thousands] + ' тисяч' + (thousands === 1 ? 'а' : '') + ' ';
    }
    
    if (hundreds > 0) {
      result += hundredsWords[hundreds] + ' ';
    }
    
    if (tens === 1) {
      result += teens[ones] + ' ';
    } else {
      if (tens > 0) result += tensWords[tens] + ' ';
      if (ones > 0) result += digits[ones] + ' ';
    }
    
    return result.trim() || 'нуль';
  }
  
  // ==========================================
  // FUTURE: Full text retrieval
  // ==========================================
  
  /**
   * Get full text of law (Not implemented in MVP)
   * Future: Scraping or Liga API
   */
  async getLawFullText(lawCode: string): Promise<string> {
    throw new Error('Full text retrieval not implemented in MVP. Use hardcoded key articles.');
  }
  
  /**
   * Update law database from zakon.rada.gov.ua (Future)
   */
  async updateLawDatabase(): Promise<void> {
    throw new Error('Auto-update not implemented. Manual updates via code for MVP.');
  }
}

// ==========================================
// SINGLETON INSTANCE
// ==========================================

export const ukrainianLawService = new UkrainianLawService();
