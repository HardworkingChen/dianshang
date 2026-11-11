package com.ecommerce.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ecommerce.entity.AnalyticsProductSimilarity;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface AnalyticsProductSimilarityMapper extends BaseMapper<AnalyticsProductSimilarity> {

    LocalDate selectLatestSnapshotDate(@Param("productId") Long productId);

    List<AnalyticsProductSimilarity> selectSnapshotRows(@Param("productId") Long productId,
                                                        @Param("snapshotDate") LocalDate snapshotDate,
                                                        @Param("limit") int limit);
}
