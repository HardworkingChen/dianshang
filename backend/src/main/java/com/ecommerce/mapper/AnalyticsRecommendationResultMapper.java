package com.ecommerce.mapper;

import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import com.ecommerce.entity.AnalyticsRecommendationResult;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Param;

import java.time.LocalDate;
import java.util.List;

@Mapper
public interface AnalyticsRecommendationResultMapper extends BaseMapper<AnalyticsRecommendationResult> {

    LocalDate selectLatestSnapshotDate(@Param("scene") String scene,
                                       @Param("userId") Long userId);

    List<AnalyticsRecommendationResult> selectSnapshotRows(@Param("scene") String scene,
                                                           @Param("userId") Long userId,
                                                           @Param("snapshotDate") LocalDate snapshotDate,
                                                           @Param("limit") int limit);
}
