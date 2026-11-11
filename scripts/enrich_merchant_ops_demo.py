import os
import subprocess
from collections import defaultdict
from datetime import datetime, timedelta


DB_NAME = os.environ.get("DB_NAME", "111111")
DB_USER = os.environ.get("DB_USER", "111111")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "root")
MYSQL_BASE = [
    "mysql",
    f"-u{DB_USER}",
    f"-p{DB_PASSWORD}",
    f"-D{DB_NAME}",
    "-N",
    "-B",
    "--default-character-set=utf8mb4",
]

COUPON_MARKER = "merchant-ops-demo-v3"
TEXT_MARKER = "[merchant-ops-demo]"
CONVERSATION_PREFIX = "OPSDEMO-M-"


def mysql_query(sql):
    completed = subprocess.run(
        MYSQL_BASE,
        input=sql,
        universal_newlines=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )
    rows = []
    for line in completed.stdout.splitlines():
        line = line.rstrip("\n")
        if not line:
            continue
        rows.append(line.split("\t"))
    return rows


def mysql_exec(sql):
    subprocess.run(
        MYSQL_BASE,
        input=sql,
        universal_newlines=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=True,
    )


def mysql_scalar(sql):
    rows = mysql_query(sql)
    if not rows or not rows[0]:
        return None
    return rows[0][0]


def sql_text(value):
    if value is None:
        return "NULL"
    text = str(value).replace("\\", "\\\\").replace("'", "''")
    return f"'{text}'"


def sql_number(value):
    if value is None:
        return "NULL"
    return str(value)


def now_text(delta_days=0, delta_hours=0, delta_minutes=0):
    point = datetime.now() + timedelta(days=delta_days, hours=delta_hours, minutes=delta_minutes)
    return point.strftime("%Y-%m-%d %H:%M:%S")


def cleanup_demo_artifacts():
    demo_coupon_ids = [int(row[0]) for row in mysql_query(
        f"SELECT id FROM coupon WHERE audience_note = {sql_text(COUPON_MARKER)}"
    )]
    if demo_coupon_ids:
        demo_coupon_id_csv = ",".join(str(item) for item in demo_coupon_ids)
        demo_user_coupon_ids = [int(row[0]) for row in mysql_query(
            f"SELECT id FROM user_coupon WHERE coupon_id IN ({demo_coupon_id_csv})"
        )]
        if demo_user_coupon_ids:
            demo_user_coupon_id_csv = ",".join(str(item) for item in demo_user_coupon_ids)
            mysql_exec(
                f"UPDATE `order` SET user_coupon_id = NULL WHERE user_coupon_id IN ({demo_user_coupon_id_csv});"
            )
            mysql_exec(f"DELETE FROM user_coupon WHERE id IN ({demo_user_coupon_id_csv});")
        mysql_exec(f"DELETE FROM coupon WHERE id IN ({demo_coupon_id_csv});")

    mysql_exec(
        f"DELETE FROM message WHERE content LIKE '%{TEXT_MARKER}%';"
    )
    demo_conversation_ids = [
        int(row[0]) for row in mysql_query(
            f"SELECT id FROM im_conversation WHERE conversation_no LIKE {sql_text(CONVERSATION_PREFIX + '%')}"
        )
    ]
    if demo_conversation_ids:
        id_csv = ",".join(str(item) for item in demo_conversation_ids)
        mysql_exec(f"DELETE FROM im_message WHERE conversation_id IN ({id_csv});")
        mysql_exec(f"DELETE FROM im_ticket WHERE conversation_id IN ({id_csv});")
        mysql_exec(f"DELETE FROM im_conversation WHERE id IN ({id_csv});")

    mysql_exec(
        f"DELETE FROM refund_request WHERE description LIKE '%{TEXT_MARKER}%';"
    )


def load_merchants():
    rows = mysql_query(
        """
        SELECT id, username, nickname
        FROM user
        WHERE role = 'merchant' AND username IN (
          'merchant','merchant2','merchant3','merchant4',
          'merchant5','merchant6','merchant7','merchant8'
        )
        ORDER BY id
        """
    )
    merchants = []
    for row in rows:
        merchants.append({
            "id": int(row[0]),
            "username": row[1],
            "nickname": row[2],
        })
    return merchants


def load_coupon_counts():
    counts = defaultdict(int)
    rows = mysql_query(
        "SELECT merchant_id, COUNT(*) FROM coupon WHERE merchant_id IS NOT NULL GROUP BY merchant_id"
    )
    for merchant_id, count in rows:
        counts[int(merchant_id)] = int(count)
    return counts


def load_top_products():
    rows = mysql_query(
        """
        WITH ranked AS (
          SELECT
            merchant_id,
            id,
            name,
            price,
            stock,
            COALESCE(sales_count, 0) AS sales_count,
            ROW_NUMBER() OVER (
              PARTITION BY merchant_id
              ORDER BY (COALESCE(price, 0) * COALESCE(sales_count, 0)) DESC, id ASC
            ) AS rn
          FROM product
          WHERE COALESCE(deleted, 0) = 0
            AND status = 1
            AND merchant_id IS NOT NULL
        )
        SELECT merchant_id, id, name, price, stock, sales_count, rn
        FROM ranked
        WHERE rn <= 3
        ORDER BY merchant_id, rn
        """
    )
    by_merchant = defaultdict(list)
    for row in rows:
        by_merchant[int(row[0])].append({
            "merchant_id": int(row[0]),
            "product_id": int(row[1]),
            "name": row[2],
            "price": float(row[3]),
            "stock": int(row[4]),
            "sales_count": int(row[5]),
            "rank": int(row[6]),
        })
    return by_merchant


def load_exclusive_orders():
    rows = mysql_query(
        """
        WITH merchant_orders AS (
          SELECT p.merchant_id, oi.order_id
          FROM order_item oi
          JOIN product p ON p.id = oi.product_id
          GROUP BY p.merchant_id, oi.order_id
        ),
        exclusive_orders AS (
          SELECT x.merchant_id, x.order_id
          FROM merchant_orders x
          JOIN (
            SELECT oi.order_id, MIN(p.merchant_id) AS min_mid, MAX(p.merchant_id) AS max_mid
            FROM order_item oi
            JOIN product p ON p.id = oi.product_id
            GROUP BY oi.order_id
          ) g
            ON g.order_id = x.order_id
           AND g.min_mid = x.merchant_id
           AND g.max_mid = x.merchant_id
        )
        SELECT
          eo.merchant_id,
          eo.order_id,
          o.user_id,
          o.status,
          COALESCE(o.user_coupon_id, 0) AS user_coupon_id,
          o.total_amount,
          o.order_no,
          MIN(oi.product_id) AS product_id,
          COALESCE(DATE_FORMAT(o.pay_time, '%Y-%m-%d %H:%i:%s'), ''),
          DATE_FORMAT(o.create_time, '%Y-%m-%d %H:%i:%s'),
          COUNT(rr.id) AS refund_count
        FROM exclusive_orders eo
        JOIN `order` o ON o.id = eo.order_id
        JOIN order_item oi ON oi.order_id = eo.order_id
        LEFT JOIN refund_request rr ON rr.order_id = eo.order_id
        GROUP BY
          eo.merchant_id, eo.order_id, o.user_id, o.status,
          o.user_coupon_id, o.total_amount, o.order_no, o.pay_time, o.create_time
        ORDER BY eo.merchant_id, o.create_time DESC, eo.order_id DESC
        """
    )
    by_merchant = defaultdict(list)
    for row in rows:
        by_merchant[int(row[0])].append({
            "merchant_id": int(row[0]),
            "order_id": int(row[1]),
            "user_id": int(row[2]),
            "status": int(row[3]),
            "user_coupon_id": int(row[4]),
            "total_amount": float(row[5]),
            "order_no": row[6],
            "product_id": int(row[7]),
            "pay_time": row[8] or None,
            "create_time": row[9],
            "refund_count": int(row[10]),
        })
    return by_merchant


def load_user_ids():
    rows = mysql_query(
        """
        SELECT id
        FROM user
        WHERE role = 'user' AND status = 1
        ORDER BY id
        """
    )
    return [int(row[0]) for row in rows]


def load_seckill_activities():
    rows = mysql_query(
        """
        SELECT id, name
        FROM seckill_activity
        WHERE publish_status = 1
        ORDER BY id
        """
    )
    return [{"id": int(row[0]), "name": row[1]} for row in rows]


def load_seckill_counts():
    counts = defaultdict(int)
    rows = mysql_query(
        "SELECT merchant_id, COUNT(*) FROM seckill_activity_apply GROUP BY merchant_id"
    )
    for merchant_id, count in rows:
        counts[int(merchant_id)] = int(count)
    return counts


def create_coupon(merchant, title, coupon_type, value, min_amount, max_discount, total_count):
    sql = f"""
    INSERT INTO coupon (
      name, type, value, min_amount, max_discount, total_count, used_count,
      start_time, end_time, status, scope_type, merchant_id, audience_type,
      target_segment_codes, target_user_ids, audience_note
    ) VALUES (
      {sql_text(title)},
      {sql_number(coupon_type)},
      {sql_number(value)},
      {sql_number(min_amount)},
      {sql_number(max_discount)},
      {sql_number(total_count)},
      0,
      {sql_text(now_text(delta_days=-3))},
      {sql_text(now_text(delta_days=45))},
      1,
      1,
      {sql_number(merchant["id"])},
      0,
      '',
      '',
      {sql_text(COUPON_MARKER)}
    );
    SELECT LAST_INSERT_ID();
    """
    return int(mysql_scalar(sql))


def insert_user_coupon(user_id, coupon_id, status, order_id=None, use_time=None):
    sql = f"""
    INSERT INTO user_coupon (user_id, coupon_id, status, order_id, use_time, create_time)
    VALUES (
      {sql_number(user_id)},
      {sql_number(coupon_id)},
      {sql_number(status)},
      {sql_number(order_id)},
      {sql_text(use_time) if use_time else 'NULL'},
      {sql_text(now_text(delta_days=-2))}
    );
    SELECT LAST_INSERT_ID();
    """
    return int(mysql_scalar(sql))


def enrich_coupons(merchants, coupon_counts, exclusive_orders_by_merchant, user_ids):
    created = []
    for merchant in merchants:
        if coupon_counts.get(merchant["id"], 0) > 0:
            continue
        order_candidates = [
            item for item in exclusive_orders_by_merchant.get(merchant["id"], [])
            if item["status"] in (1, 2, 3)
        ]
        order_for_binding = next((item for item in order_candidates if item["user_coupon_id"] == 0), None)
        preferred_users = []
        if order_for_binding:
            preferred_users.append(order_for_binding["user_id"])
        for user_id in user_ids:
            if user_id not in preferred_users:
                preferred_users.append(user_id)
            if len(preferred_users) >= 4:
                break
        if len(preferred_users) < 3:
            continue

        coupon_defs = [
            ("新客满99减15", 1, 15.00, 99.00, None, 80),
            ("店铺88折券", 2, 8.80, 199.00, 120.00, 60),
            ("无门槛立减10元", 3, 10.00, 0.00, None, 50),
        ]
        for index, coupon_def in enumerate(coupon_defs):
            suffix, coupon_type, value, min_amount, max_discount, total_count = coupon_def
            coupon_name = f"{merchant['nickname']} {suffix}"
            coupon_id = create_coupon(
                merchant,
                coupon_name,
                coupon_type,
                value,
                min_amount,
                max_discount,
                total_count,
            )
            issued = 0
            if index == 0 and order_for_binding:
                user_coupon_id = insert_user_coupon(
                    order_for_binding["user_id"],
                    coupon_id,
                    1,
                    order_for_binding["order_id"],
                    order_for_binding["pay_time"] or order_for_binding["create_time"],
                )
                mysql_exec(
                    f"UPDATE `order` SET user_coupon_id = {user_coupon_id} WHERE id = {order_for_binding['order_id']} AND user_coupon_id IS NULL;"
                )
                issued += 1
                for extra_user in preferred_users[1:3]:
                    insert_user_coupon(extra_user, coupon_id, 0)
                    issued += 1
            elif index == 1:
                for extra_user in preferred_users[:2]:
                    insert_user_coupon(extra_user, coupon_id, 0)
                    issued += 1
            else:
                insert_user_coupon(preferred_users[0], coupon_id, 0)
                issued += 1
            mysql_exec(
                f"UPDATE coupon SET used_count = {issued} WHERE id = {coupon_id};"
            )
            created.append((merchant["id"], coupon_id))
    return created


def enrich_seckill(merchants, seckill_counts, top_products_by_merchant, activities):
    created_ids = {}
    if not activities:
        return created_ids
    status_cycle = [0, 1, 2, 0, 1, 2, 0, 1]
    for index, merchant in enumerate(merchants):
        if seckill_counts.get(merchant["id"], 0) > 0:
            continue
        products = top_products_by_merchant.get(merchant["id"], [])
        if not products:
            continue
        product = products[0]
        activity = activities[index % len(activities)]
        seckill_price = round(max(product["price"] * 0.82, 0.01), 2)
        if seckill_price >= product["price"]:
            seckill_price = round(max(product["price"] - 1, 0.01), 2)
        seckill_stock = max(5, min(product["stock"], 24))
        audit_status = status_cycle[index % len(status_cycle)]
        reject_reason = None
        audit_time = None
        sold_count = 0
        if audit_status == 1:
            sold_count = min(6, seckill_stock)
            audit_time = now_text(delta_days=-1, delta_hours=-(index + 1))
        elif audit_status == 2:
            reject_reason = f"{TEXT_MARKER} 主图和库存承接力偏弱，建议调整后重提。"
            audit_time = now_text(delta_days=-1, delta_hours=-(index + 2))
        sql = f"""
        INSERT INTO seckill_activity_apply (
          activity_id, merchant_id, product_id, product_price, seckill_price,
          seckill_stock, sold_count, limit_per_user, audit_status, reject_reason,
          audit_time, create_time, update_time
        ) VALUES (
          {activity["id"]},
          {merchant["id"]},
          {product["product_id"]},
          {product["price"]},
          {seckill_price},
          {seckill_stock},
          {sold_count},
          2,
          {audit_status},
          {sql_text(reject_reason) if reject_reason else 'NULL'},
          {sql_text(audit_time) if audit_time else 'NULL'},
          {sql_text(now_text(delta_days=-2, delta_hours=-index))},
          {sql_text(now_text(delta_days=-2, delta_hours=-index))}
        );
        SELECT LAST_INSERT_ID();
        """
        created_ids[merchant["id"]] = int(mysql_scalar(sql))
    return created_ids


def load_latest_seckill_apply_ids():
    rows = mysql_query(
        """
        SELECT merchant_id, id
        FROM (
          SELECT merchant_id, id,
                 ROW_NUMBER() OVER (PARTITION BY merchant_id ORDER BY create_time DESC, id DESC) AS rn
          FROM seckill_activity_apply
        ) ranked
        WHERE rn = 1
        """
    )
    return {int(row[0]): int(row[1]) for row in rows}


def insert_message(user_id, title, content, msg_type, related_id, is_read, create_time):
    mysql_exec(
        f"""
        INSERT INTO message (user_id, title, content, type, related_id, is_read, create_time)
        VALUES (
          {user_id},
          {sql_text(title)},
          {sql_text(content)},
          {sql_text(msg_type)},
          {sql_number(related_id)},
          {is_read},
          {sql_text(create_time)}
        );
        """
    )


def enrich_messages(merchants, exclusive_orders_by_merchant, seckill_apply_ids):
    for index, merchant in enumerate(merchants):
        order_sample = next(iter(exclusive_orders_by_merchant.get(merchant["id"], [])), None)
        apply_id = seckill_apply_ids.get(merchant["id"])
        order_no = order_sample["order_no"] if order_sample else f"MER-{merchant['id']}"
        order_id = order_sample["order_id"] if order_sample else None
        create_base = datetime.now() - timedelta(hours=(index + 1) * 2)

        insert_message(
            merchant["id"],
            "演示订单履约提醒",
            f"{TEXT_MARKER} 订单 {order_no} 的买家正在关注发货进度，建议优先跟进。",
            "order",
            order_id,
            0,
            (create_base - timedelta(minutes=40)).strftime("%Y-%m-%d %H:%M:%S"),
        )
        if apply_id:
            insert_message(
                merchant["id"],
                "演示秒杀报名提醒",
                f"{TEXT_MARKER} 您的秒杀报名已进入排期演示流程，请及时查看秒杀报名记录。",
                "promotion",
                apply_id,
                0,
                (create_base - timedelta(minutes=18)).strftime("%Y-%m-%d %H:%M:%S"),
            )
        insert_message(
            merchant["id"],
            "演示运营看板更新",
            f"{TEXT_MARKER} 平台已刷新经营看板样本，建议查看商品承接与售后响应表现。",
            "system",
            None,
            1,
            create_base.strftime("%Y-%m-%d %H:%M:%S"),
        )


def create_im_conversation(merchant, order_sample, top_products_by_merchant):
    products = top_products_by_merchant.get(merchant["id"], [])
    if not order_sample and not products:
        return
    user_id = order_sample["user_id"] if order_sample else 4
    order_id = order_sample["order_id"] if order_sample else None
    product_id = order_sample["product_id"] if order_sample else products[0]["product_id"]
    time_anchor = datetime.now() - timedelta(hours=(merchant["id"] % 9) + 3)
    conversation_no = f"{CONVERSATION_PREFIX}{merchant['id']}"
    user_follow_up = f"{TEXT_MARKER} 你好，这笔订单想赶在明天前发出，可以帮我优先处理吗？"
    sql = f"""
    INSERT INTO im_conversation (
      conversation_no, conversation_type, user_id, merchant_id, support_agent_id,
      order_id, product_id, status, is_escalated, priority, last_message,
      last_message_type, last_sender_role, last_sender_id, last_message_time,
      unread_user, unread_merchant, unread_support, closed_time, create_time, update_time
    ) VALUES (
      {sql_text(conversation_no)},
      'merchant',
      {user_id},
      {merchant["id"]},
      NULL,
      {sql_number(order_id)},
      {product_id},
      'open',
      0,
      'high',
      {sql_text(user_follow_up)},
      'text',
      'user',
      {user_id},
      {sql_text(time_anchor.strftime("%Y-%m-%d %H:%M:%S"))},
      0,
      1,
      0,
      NULL,
      {sql_text((time_anchor - timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S"))},
      {sql_text(time_anchor.strftime("%Y-%m-%d %H:%M:%S"))}
    );
    SELECT LAST_INSERT_ID();
    """
    conversation_id = int(mysql_scalar(sql))
    message_rows = [
        (
            "system",
            None,
            "system",
            f"{TEXT_MARKER} 已为订单建立商家协同会话，请优先关注发货与售后时效。",
            1,
            (time_anchor - timedelta(minutes=28)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "merchant",
            merchant["id"],
            "text",
            "您好，仓库已经完成复核，今晚会优先打包并同步物流单号。",
            0,
            (time_anchor - timedelta(minutes=14)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "user",
            user_id,
            "text",
            user_follow_up,
            0,
            time_anchor.strftime("%Y-%m-%d %H:%M:%S"),
        ),
    ]
    for sender_role, sender_id, message_type, content, is_system, create_time in message_rows:
        mysql_exec(
            f"""
            INSERT INTO im_message (
              conversation_id, sender_role, sender_id, message_type,
              content, payload_json, is_system, create_time
            ) VALUES (
              {conversation_id},
              {sql_text(sender_role)},
              {sql_number(sender_id)},
              {sql_text(message_type)},
              {sql_text(content)},
              NULL,
              {is_system},
              {sql_text(create_time)}
            );
            """
        )


def enrich_im_conversations(merchants, exclusive_orders_by_merchant, top_products_by_merchant):
    for merchant in merchants:
        order_sample = next(iter(exclusive_orders_by_merchant.get(merchant["id"], [])), None)
        create_im_conversation(merchant, order_sample, top_products_by_merchant)


def build_refund_description(base_text, intervention_status=None):
    description = f"{TEXT_MARKER} {base_text}"
    if not intervention_status:
        return description
    meta_time = now_text(delta_hours=-6)
    metadata = (
        f'#SYS_INTERVENTION#{{"status":"{intervention_status}",'
        f'"reason":"{TEXT_MARKER} 买家申请平台协助核对时效与包装问题。",'
        f'"time":"{meta_time}"}}'
    )
    return description + "\n" + metadata


def enrich_refunds(merchants, exclusive_orders_by_merchant):
    status_cycle = [0, 2, 3, 0, 2, 3, 0, 2]
    reasons = [
        "包装破损",
        "发货时效偏慢",
        "规格与预期不符",
        "想改收货时间",
    ]
    for index, merchant in enumerate(merchants):
        order_candidates = [
            item for item in exclusive_orders_by_merchant.get(merchant["id"], [])
            if item["refund_count"] == 0 and item["status"] in (1, 2, 3)
        ]
        if not order_candidates:
            continue
        sample = order_candidates[0]
        amount = round(max(sample["total_amount"] * 0.35, 9.90), 2)
        if amount > sample["total_amount"]:
            amount = round(sample["total_amount"], 2)
        refund_status = status_cycle[index % len(status_cycle)]
        reject_reason = None
        description = build_refund_description(
            "买家反馈礼盒包装边角受压，希望协商部分退款。",
            "pending" if refund_status == 0 and index % 2 == 0 else None,
        )
        if refund_status == 2:
            reject_reason = f"{TEXT_MARKER} 订单已签收且商品完好，建议改为补偿优惠券。"
        create_time = now_text(delta_days=-1, delta_hours=-(index + 1))
        update_time = now_text(delta_hours=-(index + 1))
        mysql_exec(
            f"""
            INSERT INTO refund_request (
              order_id, user_id, reason, description, images, amount, status,
              reject_reason, create_time, update_time
            ) VALUES (
              {sample["order_id"]},
              {sample["user_id"]},
              {sql_text(reasons[index % len(reasons)])},
              {sql_text(description)},
              NULL,
              {amount},
              {refund_status},
              {sql_text(reject_reason) if reject_reason else 'NULL'},
              {sql_text(create_time)},
              {sql_text(update_time)}
            );
            """
        )


def print_summary():
    rows = mysql_query(
        """
        SELECT 'coupon', merchant_id, COUNT(*) FROM coupon
        WHERE merchant_id IS NOT NULL
        GROUP BY merchant_id
        UNION ALL
        SELECT 'seckill', merchant_id, COUNT(*) FROM seckill_activity_apply GROUP BY merchant_id
        UNION ALL
        SELECT 'message', user_id, COUNT(*) FROM message
        WHERE user_id IN (
          SELECT id FROM user WHERE role = 'merchant' AND username IN (
            'merchant','merchant2','merchant3','merchant4',
            'merchant5','merchant6','merchant7','merchant8'
          )
        )
        GROUP BY user_id
        UNION ALL
        SELECT 'conversation', merchant_id, COUNT(*) FROM im_conversation
        WHERE merchant_id IS NOT NULL
        GROUP BY merchant_id
        UNION ALL
        SELECT 'refund', p.merchant_id, COUNT(DISTINCT r.id)
        FROM refund_request r
        JOIN order_item oi ON oi.order_id = r.order_id
        JOIN product p ON p.id = oi.product_id
        GROUP BY p.merchant_id
        ORDER BY 1, 2
        """
    )
    for row in rows:
        print("\t".join(row))


def main():
    cleanup_demo_artifacts()
    merchants = load_merchants()
    coupon_counts = load_coupon_counts()
    top_products_by_merchant = load_top_products()
    exclusive_orders_by_merchant = load_exclusive_orders()
    user_ids = load_user_ids()
    activities = load_seckill_activities()
    seckill_counts = load_seckill_counts()

    enrich_coupons(merchants, coupon_counts, exclusive_orders_by_merchant, user_ids)
    enrich_seckill(merchants, seckill_counts, top_products_by_merchant, activities)
    latest_seckill_apply_ids = load_latest_seckill_apply_ids()
    enrich_messages(merchants, exclusive_orders_by_merchant, latest_seckill_apply_ids)
    enrich_im_conversations(merchants, exclusive_orders_by_merchant, top_products_by_merchant)
    enrich_refunds(merchants, exclusive_orders_by_merchant)
    print_summary()


if __name__ == "__main__":
    main()
