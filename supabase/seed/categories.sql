-- ============================================
-- Seed: Service categories and initial services
-- Run on fresh environments only
-- ============================================

-- Categories
INSERT INTO service_categories (name, name_ar, slug, description, sort_order) VALUES
  ('Health', 'صحة', 'health', 'Professional health services delivered at your doorstep', 1),
  ('Wellness', 'عافية', 'wellness', 'Premium wellness and relaxation services at home', 2),
  ('Fitness', 'لياقة بدنية', 'fitness', 'Personal fitness training and yoga at home', 3);

-- Services
INSERT INTO services (category_id, name, name_ar, slug, short_description, description, base_price_fils, base_duration_minutes, buffer_minutes, is_online, requires_address) VALUES
  -- Health
  ((SELECT id FROM service_categories WHERE slug = 'health'),
   'Physiotherapy', 'علاج طبيعي', 'physiotherapy',
   'Licensed physiotherapy sessions at home',
   'Get professional physiotherapy treatment from licensed practitioners in the comfort of your home. Includes assessment, manual therapy, and exercise prescription.',
   25000, 60, 15, false, true),

  ((SELECT id FROM service_categories WHERE slug = 'health'),
   'Online Consultation', 'استشارة عبر الإنترنت', 'online-consultation',
   'Video consultation with health professionals',
   'Connect with verified health professionals via secure video call. Ideal for follow-ups, assessments, and professional guidance.',
   15000, 30, 5, true, false),

  -- Wellness
  ((SELECT id FROM service_categories WHERE slug = 'wellness'),
   'Deep Tissue Massage', 'تدليك الأنسجة العميقة', 'deep-tissue-massage',
   'Therapeutic deep tissue massage at home',
   'Professional deep tissue massage targeting chronic muscle tension and pain. Our therapists bring premium equipment to your location.',
   30000, 60, 15, false, true),

  ((SELECT id FROM service_categories WHERE slug = 'wellness'),
   'Swedish Massage', 'تدليك سويدي', 'swedish-massage',
   'Classic Swedish relaxation massage',
   'Traditional Swedish massage for relaxation and stress relief. Full body treatment with premium oils.',
   25000, 60, 15, false, true),

  ((SELECT id FROM service_categories WHERE slug = 'wellness'),
   'Aromatherapy', 'العلاج بالروائح', 'aromatherapy',
   'Aromatherapy massage with essential oils',
   'Therapeutic massage incorporating essential oils for holistic wellbeing. Customized oil blends based on your needs.',
   28000, 60, 15, false, true),

  -- Fitness
  ((SELECT id FROM service_categories WHERE slug = 'fitness'),
   'Yoga at Home', 'يوغا في المنزل', 'yoga-at-home',
   'Private yoga sessions at your home',
   'Personalized yoga sessions with certified instructors. All levels welcome. Instructor brings mats and props.',
   20000, 60, 15, false, true),

  ((SELECT id FROM service_categories WHERE slug = 'fitness'),
   'Personal Training', 'تدريب شخصي', 'personal-training',
   'Personal fitness training at home',
   'One-on-one fitness training customized to your goals. Includes warm-up, strength training, cardio, and cooldown.',
   35000, 60, 15, false, true),

  ((SELECT id FROM service_categories WHERE slug = 'fitness'),
   'Pilates', 'بيلاتس', 'pilates',
   'Private Pilates sessions at home',
   'Mat Pilates sessions focusing on core strength, flexibility, and body awareness. All equipment provided.',
   22000, 60, 15, false, true);

-- Service variants for massage services
INSERT INTO service_variants (service_id, name, name_ar, duration_minutes, price_fils, sort_order) VALUES
  ((SELECT id FROM services WHERE slug = 'deep-tissue-massage'),
   '60 Minutes', '60 دقيقة', 60, 30000, 1),
  ((SELECT id FROM services WHERE slug = 'deep-tissue-massage'),
   '90 Minutes', '90 دقيقة', 90, 42000, 2),
  ((SELECT id FROM services WHERE slug = 'deep-tissue-massage'),
   'Couple Session (60 min)', 'جلسة زوجية (60 دقيقة)', 60, 55000, 3),

  ((SELECT id FROM services WHERE slug = 'swedish-massage'),
   '60 Minutes', '60 دقيقة', 60, 25000, 1),
  ((SELECT id FROM services WHERE slug = 'swedish-massage'),
   '90 Minutes', '90 دقيقة', 90, 35000, 2),

  ((SELECT id FROM services WHERE slug = 'personal-training'),
   'Single Session', 'جلسة واحدة', 60, 35000, 1),
  ((SELECT id FROM services WHERE slug = 'personal-training'),
   '5-Session Pack', 'حزمة 5 جلسات', 60, 30000, 2),
  ((SELECT id FROM services WHERE slug = 'personal-training'),
   '10-Session Pack', 'حزمة 10 جلسات', 60, 27000, 3);
