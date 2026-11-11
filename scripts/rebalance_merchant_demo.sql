START TRANSACTION;

-- Ensure the merchant pool is rich enough for demo and evaluation.
-- All merchant accounts use the seeded 123456 bcrypt hash.
INSERT INTO `user` (
  `username`, `password`, `nickname`, `role`, `phone`, `email`,
  `balance`, `status`, `email_verified`, `avatar`, `token_version`,
  `create_time`, `update_time`, `deleted`
)
SELECT
  'merchant3',
  '$2a$10$5A3U8xoCIITLjqFn7nGWl.b/.D154d9AwEyjLzEkdFpbRnfWbVbPa',
  '家选优品店',
  'merchant',
  '13800000020',
  'merchant3@ecommerce.com',
  0.00,
  1,
  1,
  'https://api.dicebear.com/7.x/initials/svg?seed=Merchant3&backgroundColor=13c2c2',
  0,
  '2026-05-01 15:00:23',
  NOW(),
  0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `user` WHERE `username` = 'merchant3' OR `phone` = '13800000020'
);

INSERT INTO `user` (
  `username`, `password`, `nickname`, `role`, `phone`, `email`,
  `balance`, `status`, `email_verified`, `avatar`, `token_version`,
  `create_time`, `update_time`, `deleted`
)
SELECT
  'merchant4',
  '$2a$10$5A3U8xoCIITLjqFn7nGWl.b/.D154d9AwEyjLzEkdFpbRnfWbVbPa',
  '城市好物店',
  'merchant',
  '13800000021',
  'merchant4@ecommerce.com',
  0.00,
  1,
  1,
  'https://api.dicebear.com/7.x/initials/svg?seed=Merchant4&backgroundColor=fa8c16',
  0,
  '2026-05-01 15:00:23',
  NOW(),
  0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `user` WHERE `username` = 'merchant4' OR `phone` = '13800000021'
);

INSERT INTO `user` (
  `username`, `password`, `nickname`, `role`, `phone`, `email`,
  `balance`, `status`, `email_verified`, `avatar`, `token_version`,
  `create_time`, `update_time`, `deleted`
)
SELECT
  'merchant5',
  '$2a$10$5A3U8xoCIITLjqFn7nGWl.b/.D154d9AwEyjLzEkdFpbRnfWbVbPa',
  '乐活优选店',
  'merchant',
  '13800000022',
  'merchant5@ecommerce.com',
  0.00,
  1,
  1,
  'https://api.dicebear.com/7.x/initials/svg?seed=Merchant5&backgroundColor=722ed1',
  0,
  '2026-05-01 15:00:23',
  NOW(),
  0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `user` WHERE `username` = 'merchant5' OR `phone` = '13800000022'
);

INSERT INTO `user` (
  `username`, `password`, `nickname`, `role`, `phone`, `email`,
  `balance`, `status`, `email_verified`, `avatar`, `token_version`,
  `create_time`, `update_time`, `deleted`
)
SELECT
  'merchant6',
  '$2a$10$5A3U8xoCIITLjqFn7nGWl.b/.D154d9AwEyjLzEkdFpbRnfWbVbPa',
  '灵感生活馆',
  'merchant',
  '13800000023',
  'merchant6@ecommerce.com',
  0.00,
  1,
  1,
  'https://api.dicebear.com/7.x/initials/svg?seed=Merchant6&backgroundColor=eb2f96',
  0,
  '2026-05-01 15:00:23',
  NOW(),
  0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `user` WHERE `username` = 'merchant6' OR `phone` = '13800000023'
);

INSERT INTO `user` (
  `username`, `password`, `nickname`, `role`, `phone`, `email`,
  `balance`, `status`, `email_verified`, `avatar`, `token_version`,
  `create_time`, `update_time`, `deleted`
)
SELECT
  'merchant7',
  '$2a$10$5A3U8xoCIITLjqFn7nGWl.b/.D154d9AwEyjLzEkdFpbRnfWbVbPa',
  '山河严选店',
  'merchant',
  '13800000024',
  'merchant7@ecommerce.com',
  0.00,
  1,
  1,
  'https://api.dicebear.com/7.x/initials/svg?seed=Merchant7&backgroundColor=2f54eb',
  0,
  '2026-05-01 15:00:23',
  NOW(),
  0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `user` WHERE `username` = 'merchant7' OR `phone` = '13800000024'
);

INSERT INTO `user` (
  `username`, `password`, `nickname`, `role`, `phone`, `email`,
  `balance`, `status`, `email_verified`, `avatar`, `token_version`,
  `create_time`, `update_time`, `deleted`
)
SELECT
  'merchant8',
  '$2a$10$5A3U8xoCIITLjqFn7nGWl.b/.D154d9AwEyjLzEkdFpbRnfWbVbPa',
  '云仓好物店',
  'merchant',
  '13800000025',
  'merchant8@ecommerce.com',
  0.00,
  1,
  1,
  'https://api.dicebear.com/7.x/initials/svg?seed=Merchant8&backgroundColor=52c41a',
  0,
  '2026-05-01 15:00:23',
  NOW(),
  0
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM `user` WHERE `username` = 'merchant8' OR `phone` = '13800000025'
);

-- Normalize storefront labels so mixed-category allocations still look intentional.
UPDATE `user`
SET
  `nickname` = '优品旗舰店',
  `email` = COALESCE(NULLIF(`email`, ''), 'merchant@ecommerce.com'),
  `status` = 1,
  `deleted` = 0
WHERE `username` = 'merchant' AND `role` = 'merchant';

UPDATE `user`
SET
  `nickname` = '中原生活馆',
  `email` = 'merchant2@ecommerce.com',
  `status` = 1,
  `deleted` = 0
WHERE `username` = 'merchant2' AND `role` = 'merchant';

UPDATE `coupon`
SET `name` = REPLACE(`name`, '数码生活馆', '中原生活馆')
WHERE `merchant_id` = (
  SELECT `id` FROM `user` WHERE `username` = 'merchant2' AND `role` = 'merchant' LIMIT 1
)
AND `name` LIKE '数码生活馆%';

-- Redistribute all live products by descending realized revenue in round-robin order.
-- This keeps product counts at 23/23/22/22/22/22/22/22 and also smooths revenue concentration.
WITH ranked_products AS (
  SELECT
    `id`,
    ROW_NUMBER() OVER (
      ORDER BY (COALESCE(`price`, 0) * COALESCE(`sales_count`, 0)) DESC, `id` ASC
    ) AS `rn`
  FROM `product`
  WHERE COALESCE(`deleted`, 0) = 0
),
merchant_pool AS (
  SELECT 1 AS `seq`, `id` AS `merchant_id` FROM `user` WHERE `username` = 'merchant' AND `role` = 'merchant'
  UNION ALL
  SELECT 2 AS `seq`, `id` AS `merchant_id` FROM `user` WHERE `username` = 'merchant2' AND `role` = 'merchant'
  UNION ALL
  SELECT 3 AS `seq`, `id` AS `merchant_id` FROM `user` WHERE `username` = 'merchant3' AND `role` = 'merchant'
  UNION ALL
  SELECT 4 AS `seq`, `id` AS `merchant_id` FROM `user` WHERE `username` = 'merchant4' AND `role` = 'merchant'
  UNION ALL
  SELECT 5 AS `seq`, `id` AS `merchant_id` FROM `user` WHERE `username` = 'merchant5' AND `role` = 'merchant'
  UNION ALL
  SELECT 6 AS `seq`, `id` AS `merchant_id` FROM `user` WHERE `username` = 'merchant6' AND `role` = 'merchant'
  UNION ALL
  SELECT 7 AS `seq`, `id` AS `merchant_id` FROM `user` WHERE `username` = 'merchant7' AND `role` = 'merchant'
  UNION ALL
  SELECT 8 AS `seq`, `id` AS `merchant_id` FROM `user` WHERE `username` = 'merchant8' AND `role` = 'merchant'
),
assignments AS (
  SELECT
    rp.`id`,
    mp.`merchant_id`
  FROM ranked_products rp
  JOIN merchant_pool mp
    ON mp.`seq` = MOD(rp.`rn` - 1, 8) + 1
)
UPDATE `product` p
JOIN assignments a ON a.`id` = p.`id`
SET p.`merchant_id` = a.`merchant_id`;

-- Keep merchant-owned seckill records aligned with the reassigned product owner.
UPDATE `seckill_activity_apply` s
JOIN `product` p ON p.`id` = s.`product_id`
SET s.`merchant_id` = p.`merchant_id`;

COMMIT;
