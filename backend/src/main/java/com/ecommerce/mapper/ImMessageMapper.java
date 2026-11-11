package com.ecommerce.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ecommerce.entity.ImMessage;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;
import org.apache.ibatis.annotations.Select;

@Mapper
public interface ImMessageMapper extends BaseMapper<ImMessage> {

    @Select("SELECT * FROM im_message WHERE id = #{id} FOR UPDATE")
    ImMessage selectByIdForUpdate(@Param("id") Long id);
}

