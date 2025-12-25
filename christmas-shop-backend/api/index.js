const { createClient } = require('@supabase/supabase-js');
const cors = require('cors');

// 初始化Supabase客户端
const supabaseUrl = process.env.SUPABASE_URL || 'https://tjmlorcvthmsbpygedtk.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'sb_secret_HglKJ5zCI1tFYxIZHORyaA_nVC1Tczm';

console.log('Supabase URL:', supabaseUrl ? '已设置' : '未设置');
console.log('Supabase Key:', supabaseKey ? '已设置' : '未设置');

const supabase = createClient(supabaseUrl, supabaseKey);

// CORS配置
const corsMiddleware = cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
});

module.exports = async (req, res) => {
  // 应用CORS
  corsMiddleware(req, res, async () => {
    if (req.method === 'OPTIONS') {
      return res.status(200).end();
    }
    
    try {
      let action, data;
      
      // 解析请求数据
      if (req.method === 'GET') {
        action = req.query.action;
        data = req.query;
      } else {
        try {
          const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
          action = body?.action;
          data = body?.data || body;
        } catch (e) {
          return res.status(400).json({ error: '无效的JSON数据' });
        }
      }
      
      console.log('[API请求]', { 
        method: req.method, 
        action, 
        data: data ? JSON.stringify(data).substring(0, 100) : '无数据' 
      });
      
      if (!action) {
        return res.status(400).json({ error: '缺少action参数' });
      }
      
      // 路由处理
      switch(action) {
        case 'test':
          return await handleTest(req, res);
        case 'get_or_create_user':
          return await handleGetOrCreateUser(data, res);
        case 'get_blindbox_items':
          return await handleGetBlindboxItems(data, res);
        case 'draw_blindbox':
          return await handleDrawBlindbox(data, res);
        case 'get_inventory':
          return await handleGetInventory(data, res);
        case 'create_share':
          return await handleCreateShare(data, res);
        case 'get_share_info':
          return await handleGetShareInfo(data, res);
        case 'process_share':
          return await handleProcessShare(data, res);
        case 'get_shop_info':
          return await handleGetShopInfo(data, res);
        case 'update_blindbox_items':
          return await handleUpdateBlindboxItems(data, res);
        case 'check_draw_limit':
          return await handleCheckDrawLimit(data, res);
        default:
          return res.status(400).json({ error: '未知操作' });
      }
    } catch (error) {
      console.error('API错误:', error);
      return res.status(500).json({ 
        error: '服务器内部错误',
        message: error.message 
      });
    }
  });
};

// ========== API处理函数 ==========

// 测试API
async function handleTest(req, res) {
  return res.status(200).json({ 
    success: true, 
    message: '圣诞小店API运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    supabase: {
      connected: !!supabaseUrl && !!supabaseKey,
      url: supabaseUrl ? '已设置' : '未设置'
    }
  });
}

// 获取或创建用户
async function handleGetOrCreateUser(data, res) {
  const { username, device_id } = data;
  
  if (!device_id) {
    return res.status(400).json({ error: '缺少设备ID' });
  }
  
  try {
    // 先检查是否已存在用户
    const { data: existingUser, error } = await supabase
      .from('users')
      .select('*')
      .eq('user_id', device_id)
      .single();
      
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    if (!existingUser) {
      // 创建新用户
      const { data: newUser, error: createError } = await supabase
        .from('users')
        .insert([
          {
            user_id: device_id,
            username: username || '用户_' + device_id.substring(0, 8),
            shop_name: username ? username + '的圣诞小店' : '我的圣诞小店',
            created_at: new Date().toISOString(),
            last_active: new Date().toISOString()
          }
        ])
        .select()
        .single();
        
      if (createError) throw createError;
      
      // 为用户生成默认盲盒
      await generateDefaultBlindbox(device_id);
      
      return res.status(200).json({ 
        success: true, 
        user: newUser, 
        isNew: true 
      });
    } else {
      // 更新最后活跃时间
      await supabase
        .from('users')
        .update({ last_active: new Date().toISOString() })
        .eq('user_id', device_id);
      
      return res.status(200).json({ 
        success: true, 
        user: existingUser, 
        isNew: false 
      });
    }
  } catch (error) {
    console.error('获取/创建用户失败:', error);
    return res.status(500).json({ error: '用户操作失败', details: error.message });
  }
}

// 获取店铺信息
async function handleGetShopInfo(data, res) {
  const { sharer_id } = data;
  
  if (!sharer_id) {
    return res.status(400).json({ error: '缺少分享者ID' });
  }
  
  try {
    const { data: shopInfo, error } = await supabase
      .from('users')
      .select('user_id, username, shop_name, created_at')
      .eq('user_id', sharer_id)
      .single();
      
    if (error) throw error;
    
    return res.status(200).json({ 
      success: true, 
      shop: shopInfo 
    });
  } catch (error) {
    console.error('获取店铺信息失败:', error);
    return res.status(404).json({ error: '店铺不存在' });
  }
}

// 获取盲盒物品
async function handleGetBlindboxItems(data, res) {
  const { user_id, sharer_id } = data;
  
  const targetUserId = sharer_id || user_id;
  const isSharing = !!sharer_id;
  
  if (!targetUserId) {
    return res.status(400).json({ error: '缺少用户ID' });
  }
  
  try {
    const { data: items, error } = await supabase
      .from('blindbox_items')
      .select('*')
      .eq('user_id', targetUserId)
      .order('order_index', { ascending: true });
      
    if (error) throw error;
    
    // 如果没有物品，生成默认设置
    if (!items || items.length === 0) {
      const defaultItems = await generateDefaultBlindbox(targetUserId);
      
      // 如果是分享链接，隐藏概率信息
      const itemsToReturn = isSharing ? defaultItems.map(item => ({
        id: item.id,
        user_id: item.user_id,
        item_name: item.item_name,
        video_name: item.video_name,
        order_index: item.order_index,
        is_custom: item.is_custom
      })) : defaultItems;
      
      return res.status(200).json({ 
        success: true, 
        items: itemsToReturn,
        isDefault: true
      });
    } else {
      // 如果是分享链接，隐藏概率信息
      const itemsToReturn = isSharing ? items.map(item => ({
        id: item.id,
        user_id: item.user_id,
        item_name: item.item_name,
        video_name: item.video_name,
        order_index: item.order_index,
        is_custom: item.is_custom
      })) : items;
      
      return res.status(200).json({ 
        success: true, 
        items: itemsToReturn,
        isDefault: false
      });
    }
  } catch (error) {
    console.error('获取盲盒物品失败:', error);
    return res.status(500).json({ error: '获取盲盒失败', details: error.message });
  }
}

// 更新盲盒物品
async function handleUpdateBlindboxItems(data, res) {
  const { user_id, items } = data;
  
  if (!user_id || !items || !Array.isArray(items)) {
    return res.status(400).json({ error: '缺少参数或参数格式错误' });
  }
  
  try {
    // 验证概率总和为100
    const totalProbability = items.reduce((sum, item) => sum + (item.probability || 0), 0);
    if (totalProbability !== 100) {
      return res.status(400).json({ 
        error: `概率总和必须为100%，当前为${totalProbability}%` 
      });
    }
    
    // 删除旧数据
    const { error: deleteError } = await supabase
      .from('blindbox_items')
      .delete()
      .eq('user_id', user_id);
    
    if (deleteError) throw deleteError;
    
    // 插入新数据
    const itemsToInsert = items.map((item, index) => ({
      user_id: user_id,
      item_name: item.name || `物品${index + 1}`,
      video_name: item.video_name || `${Math.floor(Math.random() * 15) + 1}.mp4`,
      probability: item.probability || Math.floor(100 / items.length),
      is_custom: item.is_custom || false,
      order_index: index
    }));
    
    const { data: insertedItems, error: insertError } = await supabase
      .from('blindbox_items')
      .insert(itemsToInsert)
      .select();
    
    if (insertError) throw insertError;
    
    return res.status(200).json({ 
      success: true, 
      items: insertedItems,
      message: '盲盒设置更新成功'
    });
  } catch (error) {
    console.error('更新盲盒物品失败:', error);
    return res.status(500).json({ error: '更新盲盒失败', details: error.message });
  }
}

// 抽取盲盒
async function handleDrawBlindbox(data, res) {
  const { user_id, sharer_id } = data;
  
  if (!user_id) {
    return res.status(400).json({ error: '缺少用户ID' });
  }
  
  const targetUserId = sharer_id || user_id;
  
  try {
    // 检查抽取限制
    const { data: drawRecord, error: drawError } = await supabase
      .from('draw_records')
      .select('*')
      .eq('user_id', user_id)
      .eq('sharer_id', sharer_id || user_id)
      .single();
    
    let drawCount = 0;
    let recordId = null;
    
    if (!drawError && drawRecord) {
      drawCount = drawRecord.draw_count || 0;
      recordId = drawRecord.id;
    }
    
    if (drawCount >= 3) {
      return res.status(400).json({ 
        success: false,
        error: '抽取次数已达上限',
        remaining: 0,
        drawCount
      });
    }
    
    // 获取盲盒物品
    const { data: items, error: itemsError } = await supabase
      .from('blindbox_items')
      .select('*')
      .eq('user_id', targetUserId);
      
    if (itemsError || !items || items.length === 0) {
      return res.status(500).json({ error: '盲盒设置不存在' });
    }
    
    // 根据概率抽取
    const totalProbability = items.reduce((sum, item) => sum + (item.probability || 0), 0);
    
    if (totalProbability <= 0) {
      return res.status(500).json({ error: '概率设置错误' });
    }
    
    let random = Math.random() * totalProbability;
    let selectedItem = null;
    
    for (const item of items) {
      random -= item.probability || 0;
      if (random <= 0) {
        selectedItem = item;
        break;
      }
    }
    
    if (!selectedItem) {
      selectedItem = items[items.length - 1];
    }
    
    const isThanks = selectedItem.item_name === '谢谢惠顾';
    
    // 更新抽取记录
    if (recordId) {
      await supabase
        .from('draw_records')
        .update({
          draw_count: drawCount + 1,
          last_draw: new Date().toISOString(),
          last_item_id: selectedItem.id,
          thanks_count: (drawRecord.thanks_count || 0) + (isThanks ? 1 : 0)
        })
        .eq('id', recordId);
    } else {
      await supabase
        .from('draw_records')
        .insert([{
          user_id,
          sharer_id: sharer_id || user_id,
          draw_count: 1,
          last_draw: new Date().toISOString(),
          last_item_id: selectedItem.id,
          thanks_count: isThanks ? 1 : 0
        }]);
    }
    
    // 如果不是"谢谢惠顾"，添加到背包
    if (!isThanks) {
      await addToInventory(user_id, selectedItem.id);
    }
    
    // 如果是分享链接访问，不返回概率信息
    const itemResponse = sharer_id ? {
      id: selectedItem.id,
      item_name: selectedItem.item_name,
      video_name: selectedItem.video_name,
      is_custom: selectedItem.is_custom
    } : selectedItem;
    
    return res.status(200).json({ 
      success: true, 
      item: itemResponse,
      isThanks,
      remaining: 3 - (drawCount + 1),
      drawCount: drawCount + 1
    });
  } catch (error) {
    console.error('抽取盲盒失败:', error);
    return res.status(500).json({ 
      error: '抽取失败', 
      details: error.message 
    });
  }
}

// 检查抽取限制
async function handleCheckDrawLimit(data, res) {
  const { user_id, sharer_id } = data;
  
  if (!user_id) {
    return res.status(400).json({ error: '缺少用户ID' });
  }
  
  try {
    const { data: drawRecord, error } = await supabase
      .from('draw_records')
      .select('*')
      .eq('user_id', user_id)
      .eq('sharer_id', sharer_id || user_id)
      .single();
    
    let drawCount = 0;
    
    if (!error && drawRecord) {
      drawCount = drawRecord.draw_count || 0;
    }
    
    const remaining = Math.max(0, 3 - drawCount);
    
    return res.status(200).json({ 
      success: true,
      allowed: remaining > 0,
      remaining: remaining,
      drawCount: drawCount
    });
  } catch (error) {
    console.error('检查抽取限制失败:', error);
    return res.status(500).json({ 
      error: '检查失败', 
      details: error.message 
    });
  }
}

// 获取背包
async function handleGetInventory(data, res) {
  const { user_id } = data;
  
  if (!user_id) {
    return res.status(400).json({ error: '缺少用户ID' });
  }
  
  try {
    const { data: inventory, error } = await supabase
      .from('inventory')
      .select(`
        *,
        blindbox_items (
          id,
          item_name,
          video_name,
          is_custom
        )
      `)
      .eq('user_id', user_id)
      .order('obtained_at', { ascending: false });
      
    if (error) throw error;
    
    // 格式化背包数据
    const formattedInventory = (inventory || []).map(item => ({
      id: item.id,
      item_id: item.item_id,
      quantity: item.quantity,
      obtained_at: item.obtained_at,
      item_name: item.blindbox_items?.item_name || '未知物品',
      video_name: item.blindbox_items?.video_name,
      is_custom: item.blindbox_items?.is_custom || false
    }));
    
    return res.status(200).json({ 
      success: true, 
      inventory: formattedInventory 
    });
  } catch (error) {
    console.error('获取背包失败:', error);
    return res.status(500).json({ 
      error: '获取背包失败', 
      details: error.message 
    });
  }
}

// 创建分享
async function handleCreateShare(data, res) {
  const { user_id, share_type = 'shop' } = data;
  
  if (!user_id) {
    return res.status(400).json({ error: '缺少用户ID' });
  }
  
  try {
    // 生成分享码
    const shareCode = generateShareCode();
    
    // 获取用户信息
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('username, shop_name')
      .eq('user_id', user_id)
      .single();
      
    if (userError) throw userError;
    
    // 创建分享记录
    const { data: share, error } = await supabase
      .from('shares')
      .insert([
        {
          from_user_id: user_id,
          share_code: shareCode,
          share_type: share_type,
          data: {
            username: user.username,
            shop_name: user.shop_name,
            timestamp: Date.now()
          },
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
          used: false
        }
      ])
      .select()
      .single();
      
    if (error) throw error;
    
    // 生成分享URL（前端需要自己处理域名）
    const shareUrl = `https://YOUR_FRONTEND_URL/shop.html?code=${shareCode}`;
    
    return res.status(200).json({ 
      success: true, 
      share: {
        code: shareCode,
        url: shareUrl,
        short_url: shareUrl,
        expires_at: share.expires_at,
        username: user.username,
        shop_name: user.shop_name
      }
    });
  } catch (error) {
    console.error('创建分享失败:', error);
    return res.status(500).json({ 
      error: '创建分享失败', 
      details: error.message 
    });
  }
}

// 获取分享信息
async function handleGetShareInfo(data, res) {
  const { share_code } = data;
  
  if (!share_code) {
    return res.status(400).json({ error: '缺少分享码' });
  }
  
  try {
    const { data: share, error } = await supabase
      .from('shares')
      .select(`
        *,
        from_user:users!from_user_id(username, shop_name)
      `)
      .eq('share_code', share_code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();
      
    if (error || !share) {
      return res.status(404).json({ error: '分享不存在或已过期' });
    }
    
    return res.status(200).json({ 
      success: true, 
      share: {
        share_code: share.share_code,
        share_type: share.share_type,
        from_user_id: share.from_user_id,
        username: share.from_user?.username,
        shop_name: share.from_user?.shop_name,
        data: share.data,
        expires_at: share.expires_at,
        created_at: share.created_at
      }
    });
  } catch (error) {
    console.error('获取分享信息失败:', error);
    return res.status(500).json({ 
      error: '获取分享信息失败', 
      details: error.message 
    });
  }
}

// 处理分享
async function handleProcessShare(data, res) {
  const { share_code, user_id } = data;
  
  if (!share_code || !user_id) {
    return res.status(400).json({ error: '缺少参数' });
  }
  
  try {
    // 获取分享信息
    const { data: share, error: shareError } = await supabase
      .from('shares')
      .select('*')
      .eq('share_code', share_code)
      .eq('used', false)
      .gt('expires_at', new Date().toISOString())
      .single();
      
    if (shareError || !share) {
      return res.status(404).json({ error: '分享不存在或已过期' });
    }
    
    if (share.from_user_id === user_id) {
      return res.status(400).json({ error: '不能接受自己的分享' });
    }
    
    // 标记分享为已使用
    await supabase
      .from('shares')
      .update({ 
        used: true,
        used_by: user_id,
        used_at: new Date().toISOString()
      })
      .eq('id', share.id);
    
    // 如果是店铺分享，返回分享者信息
    if (share.share_type === 'shop') {
      return res.status(200).json({ 
        success: true,
        message: '店铺分享处理成功',
        share_type: 'shop',
        from_user_id: share.from_user_id,
        data: share.data
      });
    }
    
    return res.status(200).json({ 
      success: true,
      message: '分享处理成功'
    });
  } catch (error) {
    console.error('处理分享失败:', error);
    return res.status(500).json({ 
      error: '处理分享失败', 
      details: error.message 
    });
  }
}

// ========== 辅助函数 ==========

// 生成默认盲盒
async function generateDefaultBlindbox(user_id) {
  const defaultItems = [];
  const selectedVideos = [];
  
  // 随机选择5个不重复的1-15
  while (selectedVideos.length < 5) {
    const randomNum = Math.floor(Math.random() * 15) + 1;
    if (!selectedVideos.includes(randomNum)) {
      selectedVideos.push(randomNum);
    }
  }
  
  // 添加5个礼盒（每个16%概率）
  for (let i = 0; i < 5; i++) {
    const itemData = {
      user_id: user_id,
      item_name: `圣诞惊喜礼盒${selectedVideos[i]}`,
      video_name: `${selectedVideos[i]}.mp4`,
      probability: 16,
      is_custom: false,
      order_index: i
    };
    
    const { data: item, error } = await supabase
      .from('blindbox_items')
      .insert([itemData])
      .select()
      .single();
      
    if (!error) defaultItems.push(item);
  }
  
  // 添加谢谢惠顾（20%概率）
  const thanksItem = {
    user_id: user_id,
    item_name: '谢谢惠顾',
    video_name: null,
    probability: 20,
    is_custom: false,
    order_index: 5
  };
  
  const { data: thanksItemData, error: thanksError } = await supabase
    .from('blindbox_items')
    .insert([thanksItem])
    .select()
    .single();
    
  if (!thanksError && thanksItemData) {
    defaultItems.push(thanksItemData);
  }
  
  return defaultItems;
}

// 添加到背包
async function addToInventory(user_id, item_id, quantity = 1) {
  try {
    // 检查是否已存在
    const { data: existingItem, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('user_id', user_id)
      .eq('item_id', item_id)
      .single();
    
    if (existingItem && !error) {
      // 增加数量
      await supabase
        .from('inventory')
        .update({ 
          quantity: existingItem.quantity + quantity,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingItem.id);
    } else {
      // 新增物品
      await supabase
        .from('inventory')
        .insert([{
          user_id,
          item_id,
          quantity,
          obtained_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }]);
    }
  } catch (error) {
    console.error('添加到背包失败:', error);
    throw error;
  }
}

// 生成分享码
function generateShareCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
