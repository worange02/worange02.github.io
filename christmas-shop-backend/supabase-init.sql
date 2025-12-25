-- 圣诞小店数据库初始化脚本
-- 在Supabase SQL编辑器中运行此脚本

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(100),
  shop_name VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_active TIMESTAMPTZ DEFAULT NOW()
);

-- 盲盒物品表
CREATE TABLE IF NOT EXISTS blindbox_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  item_name VARCHAR(100) NOT NULL,
  video_name VARCHAR(255),
  probability INTEGER DEFAULT 0,
  is_custom BOOLEAN DEFAULT false,
  order_index INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 背包物品表
CREATE TABLE IF NOT EXISTS inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  item_id UUID NOT NULL,
  quantity INTEGER DEFAULT 1,
  obtained_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 分享记录表
CREATE TABLE IF NOT EXISTS shares (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  from_user_id VARCHAR(255) NOT NULL,
  share_code VARCHAR(50) UNIQUE NOT NULL,
  share_type VARCHAR(20) DEFAULT 'shop',
  data JSONB,
  used BOOLEAN DEFAULT false,
  used_by VARCHAR(255),
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

-- 抽取记录表
CREATE TABLE IF NOT EXISTS draw_records (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id VARCHAR(255) NOT NULL,
  sharer_id VARCHAR(255),
  draw_count INTEGER DEFAULT 0,
  last_draw TIMESTAMPTZ,
  last_item_id UUID,
  thanks_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, sharer_id)
);

-- 创建索引
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_blindbox_items_user_id ON blindbox_items(user_id);
CREATE INDEX IF NOT EXISTS idx_inventory_user_id ON inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_shares_share_code ON shares(share_code);
CREATE INDEX IF NOT EXISTS idx_shares_expires ON shares(expires_at);
CREATE INDEX IF NOT EXISTS idx_draw_records_user_sharer ON draw_records(user_id, sharer_id);

-- 启用行级安全性（可选）
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE blindbox_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE draw_records ENABLE ROW LEVEL SECURITY;

-- 创建策略（允许公开访问）
DROP POLICY IF EXISTS "允许所有人读取用户" ON users;
CREATE POLICY "允许所有人读取用户" ON users FOR SELECT USING (true);
DROP POLICY IF EXISTS "允许所有人插入用户" ON users;
CREATE POLICY "允许所有人插入用户" ON users FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "允许所有人更新用户" ON users;
CREATE POLICY "允许所有人更新用户" ON users FOR UPDATE USING (true);

DROP POLICY IF EXISTS "允许所有人读取盲盒物品" ON blindbox_items;
CREATE POLICY "允许所有人读取盲盒物品" ON blindbox_items FOR SELECT USING (true);
DROP POLICY IF EXISTS "允许所有人插入盲盒物品" ON blindbox_items;
CREATE POLICY "允许所有人插入盲盒物品" ON blindbox_items FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "允许所有人更新盲盒物品" ON blindbox_items;
CREATE POLICY "允许所有人更新盲盒物品" ON blindbox_items FOR UPDATE USING (true);
DROP POLICY IF EXISTS "允许所有人删除盲盒物品" ON blindbox_items;
CREATE POLICY "允许所有人删除盲盒物品" ON blindbox_items FOR DELETE USING (true);

DROP POLICY IF EXISTS "允许所有人读取背包" ON inventory;
CREATE POLICY "允许所有人读取背包" ON inventory FOR SELECT USING (true);
DROP POLICY IF EXISTS "允许所有人插入背包" ON inventory;
CREATE POLICY "允许所有人插入背包" ON inventory FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "允许所有人更新背包" ON inventory;
CREATE POLICY "允许所有人更新背包" ON inventory FOR UPDATE USING (true);

DROP POLICY IF EXISTS "允许所有人读取分享" ON shares;
CREATE POLICY "允许所有人读取分享" ON shares FOR SELECT USING (true);
DROP POLICY IF EXISTS "允许所有人插入分享" ON shares;
CREATE POLICY "允许所有人插入分享" ON shares FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "允许所有人更新分享" ON shares;
CREATE POLICY "允许所有人更新分享" ON shares FOR UPDATE USING (true);

DROP POLICY IF EXISTS "允许所有人读取抽取记录" ON draw_records;
CREATE POLICY "允许所有人读取抽取记录" ON draw_records FOR SELECT USING (true);
DROP POLICY IF EXISTS "允许所有人插入抽取记录" ON draw_records;
CREATE POLICY "允许所有人插入抽取记录" ON draw_records FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "允许所有人更新抽取记录" ON draw_records;
CREATE POLICY "允许所有人更新抽取记录" ON draw_records FOR UPDATE USING (true);

-- 插入测试数据
INSERT INTO users (user_id, username, shop_name) 
VALUES 
  ('test_user_1', '测试用户1', '测试小店1'),
  ('test_user_2', '测试用户2', '测试小店2')
ON CONFLICT (user_id) DO NOTHING;

-- 输出完成信息
SELECT '✅ 数据库初始化完成！' as message;
