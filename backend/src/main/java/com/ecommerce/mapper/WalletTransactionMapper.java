package com.ecommerce.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ecommerce.entity.WalletTransaction;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.Map;

@Mapper
public interface WalletTransactionMapper extends BaseMapper<WalletTransaction> {

    BigDecimal selectAmountSumByType(@Param("type") String type,
                                     @Param("startTime") LocalDateTime startTime);

    Long selectCountByType(@Param("type") String type,
                           @Param("startTime") LocalDateTime startTime);

    Map<String, Object> selectAmountSummaryByType(@Param("type") String type,
                                                  @Param("startTime") LocalDateTime startTime);
}
