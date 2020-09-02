package com.zufar.bookshelf.repository;

import com.zufar.bookshelf.entity.Country;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CountryRepository extends JpaRepository<Country, Long> {
}
